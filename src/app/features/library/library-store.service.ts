import { Injectable, computed, inject, signal } from '@angular/core';

import {
  PDF_FILE_MESSAGES,
  PdfFileValidationError,
  validatePdfFile,
} from '../../core/files/pdf-file-validation';
import {
  DocumentPermissionDeniedError,
  DocumentUnavailableError,
  isDomExceptionNamed,
} from '../../core/file-system/document-source';
import { FileHandleSource } from '../../core/file-system/file-handle-source';
import { StoredDocument } from '../../core/models/stored-document.model';
import { renderFirstPageThumbnail } from '../../core/pdfjs/pdf-thumbnail';
import { PdfLoadError, loadPdfDocument } from '../../core/pdfjs/pdfjs.config';
import { DocumentRepository } from '../../core/storage/document-repository.service';

/** What the dropzone or the picker produced: a real handle (Chromium) or a `File` (other browsers). */
export type PickedDocument =
  { kind: 'file-handle'; handle: FileSystemFileHandle } | { kind: 'file'; file: File };

export const LIBRARY_MESSAGES = {
  sessionOnly:
    'El navegador no permite guardar la biblioteca. Los documentos solo estarán disponibles durante esta sesión.',
  unavailable: 'No disponible: el archivo fue movido o eliminado.',
  loadFailed: 'No fue posible cargar la biblioteca.',
  viewLoadFailed: 'No fue posible cargar esta vista. Recarga la página.',
} as const;

@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly repository = inject(DocumentRepository);

  private readonly documentsState = signal<StoredDocument[]>([]);
  private readonly unavailableIdsState = signal<ReadonlySet<string>>(new Set());
  private readonly isLoadingState = signal(false);
  private readonly isAddingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private hasRequestedPersistence = false;
  private isGeneratingThumbnails = false;

  readonly documents = this.documentsState.asReadonly();
  readonly unavailableIds = this.unavailableIdsState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly isAdding = this.isAddingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly isPersistent = this.repository.isAvailable;
  readonly isEmpty = computed(() => !this.isLoadingState() && this.documentsState().length === 0);

  async load(): Promise<void> {
    this.isLoadingState.set(true);
    try {
      this.documentsState.set(await this.repository.list());
    } catch {
      this.errorState.set(LIBRARY_MESSAGES.loadFailed);
    } finally {
      this.isLoadingState.set(false);
    }
  }

  /**
   * Validates (size → type → header → parseable, not password protected) and
   * stores the record. Returns the new record or `null` when rejected.
   */
  async addDocument(picked: PickedDocument): Promise<StoredDocument | null> {
    this.isAddingState.set(true);
    this.errorState.set(null);
    try {
      const file =
        picked.kind === 'file' ? picked.file : await this.readFileFromHandle(picked.handle);
      await validatePdfFile(file);
      if (picked.kind === 'file' && !(await this.repository.hasSpaceFor(file.size))) {
        this.errorState.set(PDF_FILE_MESSAGES.noStorageSpace);
        return null;
      }
      const { pageCount, thumbnailDataUrl } = await readDocumentPreview(file);
      const now = Date.now();
      const document: StoredDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        sizeBytes: file.size,
        pageCount,
        addedAt: now,
        lastOpenedAt: now,
        lastPage: 1,
        sourceKind: picked.kind === 'file-handle' ? 'file-handle' : 'stored-blob',
        ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
        ...(picked.kind === 'file-handle' ? { handle: picked.handle } : { blob: file }),
      };
      await this.repository.save(document);
      // Requesting persistent storage opens a permission prompt in some
      // browsers, so it must never block adding a document.
      this.requestPersistenceOnce();
      this.documentsState.update((documents) => [document, ...documents]);
      return document;
    } catch (error) {
      this.errorState.set(describeAddError(error));
      return null;
    } finally {
      this.isAddingState.set(false);
    }
  }

  /**
   * Checks that a handle-backed document is still reachable before navigating.
   * Runs inside the click gesture so the read/write prompt is allowed; asking
   * for both here means opening and saving later do not prompt again.
   */
  async prepareToOpen(document: StoredDocument): Promise<boolean> {
    this.errorState.set(null);
    if (document.sourceKind !== 'file-handle' || !document.handle) {
      return true;
    }
    try {
      await new FileHandleSource(document.handle).ensurePermission('readwrite');
      await document.handle.getFile();
      this.clearUnavailable(document.id);
      return true;
    } catch (error) {
      if (
        error instanceof DocumentUnavailableError ||
        isDomExceptionNamed(error, 'NotFoundError')
      ) {
        this.markUnavailable(document.id);
      } else if (error instanceof DocumentPermissionDeniedError) {
        this.errorState.set(error.message);
      } else {
        this.errorState.set(PDF_FILE_MESSAGES.cannotOpen);
      }
      return false;
    }
  }

  /** Replaces the handle of an unavailable record with a newly picked file. */
  async relinkDocument(id: string, handle: FileSystemFileHandle): Promise<boolean> {
    this.errorState.set(null);
    try {
      const file = await this.readFileFromHandle(handle);
      await validatePdfFile(file);
      const updated = await this.repository.update(id, {
        handle,
        name: file.name,
        sizeBytes: file.size,
        sourceKind: 'file-handle',
      });
      if (!updated) {
        return false;
      }
      this.documentsState.update((documents) =>
        documents.map((document) => (document.id === id ? updated : document)),
      );
      this.clearUnavailable(id);
      return true;
    } catch (error) {
      this.errorState.set(describeAddError(error));
      return false;
    }
  }

  /** Removes the record (and the Blob copy, if any). Never deletes the file on disk. */
  async removeDocument(id: string): Promise<void> {
    await this.repository.remove(id);
    this.documentsState.update((documents) => documents.filter((document) => document.id !== id));
    this.clearUnavailable(id);
  }

  dismissError(): void {
    this.errorState.set(null);
  }

  /**
   * Renders the thumbnails of documents stored before previews existed.
   * Only reads what is already accessible, so it never opens a permission
   * prompt; a document that cannot be read keeps its generic icon.
   */
  async generateMissingThumbnails(): Promise<void> {
    if (this.isGeneratingThumbnails) {
      return;
    }
    this.isGeneratingThumbnails = true;
    try {
      for (const document of this.documentsState()) {
        if (document.thumbnailDataUrl) {
          continue;
        }
        const thumbnailDataUrl = await this.renderThumbnail(document);
        if (!thumbnailDataUrl) {
          continue;
        }
        const updated = await this.repository.update(document.id, { thumbnailDataUrl });
        if (updated) {
          this.documentsState.update((documents) =>
            documents.map((current) => (current.id === updated.id ? updated : current)),
          );
        }
      }
    } finally {
      this.isGeneratingThumbnails = false;
    }
  }

  private async renderThumbnail(document: StoredDocument): Promise<string | null> {
    const bytes = await this.readBytesWithoutPrompting(document);
    if (!bytes) {
      return null;
    }
    try {
      const pdfDocument = await loadPdfDocument(bytes);
      try {
        return await renderFirstPageThumbnail(pdfDocument);
      } finally {
        await pdfDocument.loadingTask.destroy().catch(() => undefined);
      }
    } catch {
      // A preview is optional; a document that cannot be parsed keeps its icon.
      return null;
    }
  }

  private async readBytesWithoutPrompting(
    document: StoredDocument,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
      if (document.sourceKind === 'stored-blob' && document.blob) {
        return new Uint8Array(await document.blob.arrayBuffer());
      }
      if (document.sourceKind === 'file-handle' && document.handle) {
        // Asking for the permission here would prompt without the user having
        // requested anything, so an ungranted handle is skipped.
        if ((await document.handle.queryPermission({ mode: 'read' })) !== 'granted') {
          return null;
        }
        return new Uint8Array(await (await document.handle.getFile()).arrayBuffer());
      }
    } catch {
      // The file may be gone; opening the document reports it properly.
    }
    return null;
  }

  private markUnavailable(id: string): void {
    this.unavailableIdsState.update((ids) => new Set([...ids, id]));
  }

  private clearUnavailable(id: string): void {
    if (this.unavailableIdsState().has(id)) {
      this.unavailableIdsState.update(
        (ids) => new Set([...ids].filter((current) => current !== id)),
      );
    }
  }

  /** Handles coming from the picker or drag & drop already have read access; no prompt needed here. */
  private async readFileFromHandle(handle: FileSystemFileHandle): Promise<File> {
    try {
      return await handle.getFile();
    } catch (error) {
      if (isDomExceptionNamed(error, 'NotAllowedError')) {
        throw new DocumentPermissionDeniedError();
      }
      throw error;
    }
  }

  private requestPersistenceOnce(): void {
    if (this.hasRequestedPersistence) {
      return;
    }
    this.hasRequestedPersistence = true;
    void this.repository.requestPersistentStorage();
  }
}

/**
 * Parses the document once to reject corrupt or password protected files, to
 * learn the page count and to render the thumbnail shown in the library.
 */
async function readDocumentPreview(
  file: File,
): Promise<{ pageCount: number; thumbnailDataUrl: string | null }> {
  const pdfDocument = await loadPdfDocument(new Uint8Array(await file.arrayBuffer()));
  try {
    return {
      pageCount: pdfDocument.numPages,
      thumbnailDataUrl: await renderFirstPageThumbnail(pdfDocument),
    };
  } finally {
    await pdfDocument.loadingTask.destroy().catch(() => undefined);
  }
}

export function describeAddError(error: unknown): string {
  if (error instanceof PdfFileValidationError) {
    return error.message;
  }
  if (error instanceof PdfLoadError) {
    return error.reason === 'password' ? PDF_FILE_MESSAGES.password : PDF_FILE_MESSAGES.cannotOpen;
  }
  if (error instanceof DocumentPermissionDeniedError || error instanceof DocumentUnavailableError) {
    return error.message;
  }
  return PDF_FILE_MESSAGES.cannotOpen;
}
