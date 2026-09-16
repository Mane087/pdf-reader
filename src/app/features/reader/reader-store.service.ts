import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';

import { PDF_FILE_MESSAGES } from '../../core/files/pdf-file-validation';
import { toHighlightedCopyName } from '../../core/files/copy-file-name';
import {
  DocumentPermissionDeniedError,
  DocumentSource,
  DocumentUnavailableError,
} from '../../core/file-system/document-source';
import { createDocumentSource } from '../../core/file-system/document-source.factory';
import { downloadBytes } from '../../core/file-system/download-file';
import { FileHandleSource } from '../../core/file-system/file-handle-source';
import { pickSaveFileHandle, supportsFileSystemAccess } from '../../core/file-system/file-picker';
import { SpreadModeSetting } from '../../core/models/reader-state.model';
import { StoredDocument } from '../../core/models/stored-document.model';
import { hasSelectableText } from '../../core/pdfjs/pdf-text-detection';
import { PdfLoadError, loadPdfDocument } from '../../core/pdfjs/pdfjs.config';
import { DocumentRepository } from '../../core/storage/document-repository.service';
import { ViewerPreferencesStore } from '../../core/storage/viewer-preferences-store.service';
import { PdfViewerAdapter } from './pdf-viewer-adapter.service';

const LAST_PAGE_PERSIST_DELAY_MS = 500;

export const READER_MESSAGES = {
  missingDocument: 'El documento no existe en la biblioteca.',
  noSelectableText: 'Este documento no contiene texto seleccionable.',
  saveFailed:
    'No fue posible guardar el archivo. Los cambios siguen en pantalla; inténtalo de nuevo.',
  saved: 'Cambios guardados.',
  savedCopyDownloaded: 'Copia local actualizada y descarga iniciada.',
} as const;

interface AnnotationStorageCallbacks {
  onSetModified: (() => void) | null;
  onResetModified: (() => void) | null;
}

/** State of the open document. Provided per reader screen. */
@Injectable()
export class ReaderStore {
  private readonly repository = inject(DocumentRepository);
  private readonly viewer = inject(PdfViewerAdapter);
  private readonly preferences = inject(ViewerPreferencesStore);
  private readonly destroyRef = inject(DestroyRef);

  private pdfDocument: PDFDocumentProxy | null = null;
  private source: DocumentSource | null = null;

  private readonly documentState = signal<StoredDocument | null>(null);
  private readonly isLoadingState = signal(false);
  private readonly isSavingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly noticeState = signal<string | null>(null);
  private readonly hasUnsavedChangesState = signal(false);
  private readonly hasSelectableTextState = signal(true);
  private readonly canWriteInPlaceState = signal(false);

  readonly document = this.documentState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();
  readonly isSaving = this.isSavingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly notice = this.noticeState.asReadonly();
  readonly hasUnsavedChanges = this.hasUnsavedChangesState.asReadonly();
  readonly hasSelectableText = this.hasSelectableTextState.asReadonly();
  readonly canWriteInPlace = this.canWriteInPlaceState.asReadonly();

  readonly fileName = computed(() => this.documentState()?.name ?? '');
  readonly currentPage = this.viewer.currentPage;
  readonly pageCount = this.viewer.pageCount;
  readonly scalePercent = computed(() => Math.round(this.viewer.scale() * 100));
  readonly spreadMode = this.viewer.spreadMode;
  readonly isViewerReady = this.viewer.isReady;
  readonly canSave = computed(
    () => this.hasUnsavedChangesState() && !this.isSavingState() && !this.isLoadingState(),
  );

  constructor() {
    toObservable(this.viewer.currentPage)
      .pipe(
        filter(() => this.viewer.isReady()),
        distinctUntilChanged(),
        debounceTime(LAST_PAGE_PERSIST_DELAY_MS),
        takeUntilDestroyed(),
      )
      .subscribe((page) => void this.persistLastPage(page));
    this.destroyRef.onDestroy(() => void this.close().catch(() => undefined));
  }

  async open(documentId: string): Promise<void> {
    await this.close();
    this.isLoadingState.set(true);
    this.errorState.set(null);
    this.noticeState.set(null);
    try {
      const document = await this.repository.get(documentId);
      if (!document) {
        throw new Error(READER_MESSAGES.missingDocument);
      }
      const source = createDocumentSource(document, this.repository);
      const bytes = await source.read();
      const pdfDocument = await loadPdfDocument(bytes);

      this.pdfDocument = pdfDocument;
      this.source = source;
      this.documentState.set(document);
      this.canWriteInPlaceState.set(source.canWriteInPlace);
      this.trackModifications(pdfDocument);

      const { scaleValue, spreadMode } = this.preferences.preferences();
      this.viewer.setDocument(pdfDocument, { scaleValue, spreadMode, page: document.lastPage });

      const selectable = await hasSelectableText(pdfDocument);
      this.hasSelectableTextState.set(selectable);
      if (!selectable) {
        this.noticeState.set(READER_MESSAGES.noSelectableText);
      }
      await this.repository.update(documentId, {
        lastOpenedAt: Date.now(),
        pageCount: pdfDocument.numPages,
      });
    } catch (error) {
      this.errorState.set(describeOpenError(error));
    } finally {
      this.isLoadingState.set(false);
    }
  }

  /** Writes the document in place (Chromium) or updates the local copy and downloads it (other browsers). */
  async save(): Promise<boolean> {
    const { pdfDocument, source } = this;
    if (!pdfDocument || !source || this.isSavingState()) {
      return false;
    }
    this.isSavingState.set(true);
    this.errorState.set(null);
    this.noticeState.set(null);
    try {
      // Permission prompts need the click gesture, so ask before serializing.
      await source.requestWriteAccess();
      // Always the original bytes plus the current AnnotationStorage: successive
      // saves in one session do not accumulate incremental updates.
      const bytes = await pdfDocument.saveDocument();
      // `saveDocument()` clears the modified flag of PDF.js as soon as it
      // serializes. Mirror it here, so a highlight created while the file is
      // being written marks the document as pending again.
      this.hasUnsavedChangesState.set(false);
      await source.write(bytes);
      this.noticeState.set(
        source.canWriteInPlace ? READER_MESSAGES.saved : READER_MESSAGES.savedCopyDownloaded,
      );
      const document = this.documentState();
      if (document) {
        await this.repository.update(document.id, { lastOpenedAt: Date.now() });
      }
      return true;
    } catch (error) {
      // Nothing reached the file, so the changes are still pending even though
      // PDF.js already cleared its own flag while serializing.
      this.hasUnsavedChangesState.set(true);
      this.errorState.set(describeSaveError(error));
      return false;
    } finally {
      this.isSavingState.set(false);
    }
  }

  /** "Guardar como copia": never touches the original file. */
  async saveCopy(): Promise<boolean> {
    const { pdfDocument } = this;
    const document = this.documentState();
    if (!pdfDocument || !document || this.isSavingState()) {
      return false;
    }
    // The open document keeps its pending changes: the copy is a different file.
    const hadUnsavedChanges = this.hasUnsavedChangesState();
    this.isSavingState.set(true);
    this.errorState.set(null);
    try {
      const copyName = toHighlightedCopyName(document.name);
      const bytes = await pdfDocument.saveDocument();
      if (supportsFileSystemAccess()) {
        const handle = await pickSaveFileHandle(copyName);
        if (!handle) {
          return false;
        }
        await new FileHandleSource(handle).write(bytes);
      } else {
        downloadBytes(copyName, bytes);
      }
      return true;
    } catch (error) {
      this.errorState.set(describeSaveError(error));
      return false;
    } finally {
      this.hasUnsavedChangesState.set(hadUnsavedChanges);
      this.isSavingState.set(false);
    }
  }

  setSpreadMode(mode: SpreadModeSetting): void {
    this.viewer.setSpreadMode(mode);
    this.preferences.setSpreadMode(mode);
  }

  zoomIn(): void {
    this.viewer.increaseScale();
    this.preferences.setScaleValue(this.viewer.scaleValue());
  }

  zoomOut(): void {
    this.viewer.decreaseScale();
    this.preferences.setScaleValue(this.viewer.scaleValue());
  }

  dismissMessages(): void {
    this.errorState.set(null);
    this.noticeState.set(null);
  }

  async close(): Promise<void> {
    const pdfDocument = this.pdfDocument;
    this.pdfDocument = null;
    this.source = null;
    this.documentState.set(null);
    this.hasUnsavedChangesState.set(false);
    this.viewer.clearDocument();
    if (pdfDocument) {
      try {
        // PDFDocumentProxy has no destroy(); the worker is released through its loading task.
        await pdfDocument.loadingTask.destroy();
      } catch {
        // The worker may already be gone; nothing else to release.
      }
    }
  }

  private trackModifications(pdfDocument: PDFDocumentProxy): void {
    // The published typings declare these callbacks as `null`; PDF.js invokes them when present.
    const storage = pdfDocument.annotationStorage as unknown as AnnotationStorageCallbacks;
    storage.onSetModified = () => this.hasUnsavedChangesState.set(true);
    storage.onResetModified = () => this.hasUnsavedChangesState.set(false);
  }

  private async persistLastPage(lastPage: number): Promise<void> {
    const document = this.documentState();
    if (!document || document.lastPage === lastPage) {
      return;
    }
    this.documentState.set({ ...document, lastPage });
    await this.repository.update(document.id, { lastPage });
  }
}

export function describeOpenError(error: unknown): string {
  if (error instanceof PdfLoadError) {
    return error.reason === 'password' ? PDF_FILE_MESSAGES.password : PDF_FILE_MESSAGES.cannotOpen;
  }
  if (error instanceof DocumentUnavailableError || error instanceof DocumentPermissionDeniedError) {
    return error.message;
  }
  if (error instanceof Error && error.message === READER_MESSAGES.missingDocument) {
    return error.message;
  }
  return PDF_FILE_MESSAGES.cannotOpen;
}

export function describeSaveError(error: unknown): string {
  if (error instanceof DocumentUnavailableError || error instanceof DocumentPermissionDeniedError) {
    return error.message;
  }
  return READER_MESSAGES.saveFailed;
}
