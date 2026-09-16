import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PDFDocumentProxy } from 'pdfjs-dist';

jest.mock('../../core/pdfjs/pdfjs.config', () => {
  const actual = jest.requireActual('../../core/pdfjs/pdfjs.config');
  return {
    ...actual,
    loadPdfDocument: jest.fn(),
  };
});

jest.mock('../../core/pdfjs/pdf-text-detection', () => ({
  hasSelectableText: jest.fn(),
}));

jest.mock('../../core/file-system/document-source.factory', () => ({
  createDocumentSource: jest.fn(),
}));

jest.mock('../../core/file-system/download-file', () => ({
  downloadBytes: jest.fn(),
}));

import { createDocumentSource } from '../../core/file-system/document-source.factory';
import { downloadBytes } from '../../core/file-system/download-file';
import {
  DocumentPermissionDeniedError,
  DocumentSource,
  DocumentUnavailableError,
} from '../../core/file-system/document-source';
import { PDF_FILE_MESSAGES } from '../../core/files/pdf-file-validation';
import { StoredDocument } from '../../core/models/stored-document.model';
import { hasSelectableText } from '../../core/pdfjs/pdf-text-detection';
import { PdfLoadError, loadPdfDocument } from '../../core/pdfjs/pdfjs.config';
import { DocumentRepository } from '../../core/storage/document-repository.service';
import { PdfViewerAdapter } from './pdf-viewer-adapter.service';
import {
  READER_MESSAGES,
  ReaderStore,
  describeOpenError,
  describeSaveError,
} from './reader-store.service';

const loadPdfDocumentMock = loadPdfDocument as jest.MockedFunction<typeof loadPdfDocument>;
const hasSelectableTextMock = hasSelectableText as jest.MockedFunction<typeof hasSelectableText>;
const createDocumentSourceMock = createDocumentSource as jest.MockedFunction<
  typeof createDocumentSource
>;
const downloadBytesMock = downloadBytes as jest.MockedFunction<typeof downloadBytes>;

interface FakeAnnotationStorage {
  resetModified: jest.Mock;
  onSetModified: (() => void) | null;
  onResetModified: (() => void) | null;
}

interface FakePdfDocument {
  numPages: number;
  annotationStorage: FakeAnnotationStorage;
  saveDocument: jest.Mock;
  destroy: jest.Mock;
  loadingTask: { destroy: jest.Mock };
}

interface ViewerMock {
  currentPage: WritableSignal<number>;
  pageCount: WritableSignal<number>;
  scale: WritableSignal<number>;
  scaleValue: WritableSignal<string>;
  spreadMode: WritableSignal<'single' | 'double'>;
  isReady: WritableSignal<boolean>;
  setDocument: jest.Mock;
  clearDocument: jest.Mock;
  increaseScale: jest.Mock;
  decreaseScale: jest.Mock;
  setSpreadMode: jest.Mock;
}

function makeFakePdfDocument(): FakePdfDocument {
  return {
    numPages: 3,
    annotationStorage: {
      resetModified: jest.fn(),
      onSetModified: null,
      onResetModified: null,
    },
    saveDocument: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    destroy: jest.fn().mockResolvedValue(undefined),
    loadingTask: { destroy: jest.fn().mockResolvedValue(undefined) },
  };
}

function makeViewerMock(): ViewerMock {
  return {
    currentPage: signal(1),
    pageCount: signal(0),
    scale: signal(1),
    scaleValue: signal('page-width'),
    spreadMode: signal('single'),
    isReady: signal(false),
    setDocument: jest.fn(),
    clearDocument: jest.fn(),
    increaseScale: jest.fn(),
    decreaseScale: jest.fn(),
    setSpreadMode: jest.fn(),
  };
}

describe('ReaderStore', () => {
  let viewerMock: ViewerMock;
  let repositoryMock: { get: jest.Mock; update: jest.Mock };
  let sourceMock: DocumentSource & {
    read: jest.Mock;
    write: jest.Mock;
    requestWriteAccess: jest.Mock;
  };
  let fakePdfDocument: FakePdfDocument;
  let storedDocument: StoredDocument;
  let store: ReaderStore;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    viewerMock = makeViewerMock();
    fakePdfDocument = makeFakePdfDocument();

    storedDocument = {
      id: 'doc-1',
      name: 'document.pdf',
      sizeBytes: 2048,
      pageCount: null,
      addedAt: 1000,
      lastOpenedAt: 1000,
      lastPage: 5,
      sourceKind: 'stored-blob',
    };

    repositoryMock = {
      get: jest.fn().mockResolvedValue(storedDocument),
      update: jest.fn().mockResolvedValue(undefined),
    };

    sourceMock = {
      kind: 'stored-blob',
      canWriteInPlace: true,
      read: jest.fn().mockResolvedValue(new Uint8Array()),
      write: jest.fn().mockResolvedValue(undefined),
      requestWriteAccess: jest.fn().mockResolvedValue(undefined),
    };

    createDocumentSourceMock.mockReturnValue(sourceMock);
    loadPdfDocumentMock.mockResolvedValue(fakePdfDocument as unknown as PDFDocumentProxy);
    hasSelectableTextMock.mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        ReaderStore,
        { provide: PdfViewerAdapter, useValue: viewerMock },
        { provide: DocumentRepository, useValue: repositoryMock },
      ],
    });
    store = TestBed.inject(ReaderStore);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  describe('open', () => {
    it('sets error to missingDocument when the document id does not exist', async () => {
      repositoryMock.get.mockResolvedValue(null);

      await store.open('missing');

      expect(store.error()).toBe(READER_MESSAGES.missingDocument);
      expect(store.document()).toBeNull();
      expect(store.isLoading()).toBe(false);
    });

    it('loads the document, sets canWriteInPlace, passes the stored page to the viewer, and warns when there is no selectable text', async () => {
      hasSelectableTextMock.mockResolvedValue(false);

      await store.open('doc-1');

      expect(store.document()).toEqual(storedDocument);
      expect(store.canWriteInPlace()).toBe(true);
      expect(viewerMock.setDocument).toHaveBeenCalledWith(fakePdfDocument, {
        scaleValue: 'page-width',
        spreadMode: 'single',
        page: storedDocument.lastPage,
      });
      expect(store.hasSelectableText()).toBe(false);
      expect(store.notice()).toBe(READER_MESSAGES.noSelectableText);
      expect(store.error()).toBeNull();
    });

    it('does not set a notice when the document has selectable text', async () => {
      hasSelectableTextMock.mockResolvedValue(true);

      await store.open('doc-1');

      expect(store.hasSelectableText()).toBe(true);
      expect(store.notice()).toBeNull();
    });

    it('maps a password-protected PdfLoadError to the password message', async () => {
      loadPdfDocumentMock.mockRejectedValue(
        new PdfLoadError('password', new Error('needs password')),
      );

      await store.open('doc-1');

      expect(store.error()).toBe(PDF_FILE_MESSAGES.password);
      expect(store.document()).toBeNull();
    });
  });

  describe('save', () => {
    it('returns false when nothing is open', async () => {
      await expect(store.save()).resolves.toBe(false);
    });

    it('sets hasUnsavedChanges and canSave to true when PDF.js reports a modification', async () => {
      await store.open('doc-1');

      fakePdfDocument.annotationStorage.onSetModified?.();

      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.canSave()).toBe(true);
    });

    it('writes the bytes and clears hasUnsavedChanges on success', async () => {
      await store.open('doc-1');
      fakePdfDocument.annotationStorage.onSetModified?.();

      const result = await store.save();

      expect(result).toBe(true);
      expect(fakePdfDocument.saveDocument).toHaveBeenCalledTimes(1);
      expect(sourceMock.write).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
      expect(store.hasUnsavedChanges()).toBe(false);
      expect(store.isSaving()).toBe(false);
    });

    it('asks for write access before serializing the document', async () => {
      await store.open('doc-1');
      const order: string[] = [];
      sourceMock.requestWriteAccess.mockImplementation(async () => {
        order.push('requestWriteAccess');
      });
      fakePdfDocument.saveDocument.mockImplementation(async () => {
        order.push('saveDocument');
        return new Uint8Array([1, 2, 3]);
      });

      await store.save();

      expect(order).toEqual(['requestWriteAccess', 'saveDocument']);
    });

    it('sets error to saveFailed and isSaving to false when source.write rejects', async () => {
      await store.open('doc-1');
      sourceMock.write.mockRejectedValue(new Error('disk full'));

      const result = await store.save();

      expect(result).toBe(false);
      expect(store.error()).toBe(READER_MESSAGES.saveFailed);
      expect(store.isSaving()).toBe(false);
    });

    it('keeps the changes pending when the write fails, so they can be saved again', async () => {
      await store.open('doc-1');
      fakePdfDocument.annotationStorage.onSetModified?.();
      // PDF.js clears its own modified flag while serializing, even if the
      // write that follows never reaches the file.
      fakePdfDocument.saveDocument.mockImplementation(async () => {
        fakePdfDocument.annotationStorage.onResetModified?.();
        return new Uint8Array([1, 2, 3]);
      });
      sourceMock.write.mockRejectedValue(new Error('disk full'));

      await store.save();

      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.canSave()).toBe(true);
    });

    it('marks the document as pending again when a highlight is added while writing', async () => {
      await store.open('doc-1');
      fakePdfDocument.annotationStorage.onSetModified?.();
      fakePdfDocument.saveDocument.mockImplementation(async () => {
        fakePdfDocument.annotationStorage.onResetModified?.();
        return new Uint8Array([1, 2, 3]);
      });
      sourceMock.write.mockImplementation(async () => {
        fakePdfDocument.annotationStorage.onSetModified?.();
      });

      await store.save();

      expect(store.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('saveCopy', () => {
    it('downloads a copy with the highlighted name without touching the open document', async () => {
      await store.open('doc-1');
      fakePdfDocument.annotationStorage.onSetModified?.();
      fakePdfDocument.saveDocument.mockImplementation(async () => {
        fakePdfDocument.annotationStorage.onResetModified?.();
        return new Uint8Array([1, 2, 3]);
      });

      const result = await store.saveCopy();

      expect(result).toBe(true);
      expect(downloadBytesMock).toHaveBeenCalledWith(
        'document-highlighted.pdf',
        new Uint8Array([1, 2, 3]),
      );
      expect(sourceMock.write).not.toHaveBeenCalled();
      // The copy is a different file, so the open document is still pending.
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.isSaving()).toBe(false);
    });

    it('does not mark a document as pending when there was nothing to save', async () => {
      await store.open('doc-1');

      await store.saveCopy();

      expect(store.hasUnsavedChanges()).toBe(false);
    });

    it('reports an error and keeps the pending state when serializing fails', async () => {
      await store.open('doc-1');
      fakePdfDocument.annotationStorage.onSetModified?.();
      fakePdfDocument.saveDocument.mockRejectedValue(new Error('broken'));

      const result = await store.saveCopy();

      expect(result).toBe(false);
      expect(store.error()).toBe(READER_MESSAGES.saveFailed);
      expect(store.hasUnsavedChanges()).toBe(true);
      expect(store.isSaving()).toBe(false);
    });
  });
});

describe('describeOpenError', () => {
  it('maps a password PdfLoadError to the password message', () => {
    expect(describeOpenError(new PdfLoadError('password', undefined))).toBe(
      PDF_FILE_MESSAGES.password,
    );
  });

  it('maps any other PdfLoadError reason to the generic cannotOpen message', () => {
    expect(describeOpenError(new PdfLoadError('invalid', undefined))).toBe(
      PDF_FILE_MESSAGES.cannotOpen,
    );
  });

  it('passes through a DocumentUnavailableError message', () => {
    const error = new DocumentUnavailableError();

    expect(describeOpenError(error)).toBe(error.message);
  });

  it('passes through a DocumentPermissionDeniedError message', () => {
    const error = new DocumentPermissionDeniedError();

    expect(describeOpenError(error)).toBe(error.message);
  });

  it('passes through the missingDocument message', () => {
    const error = new Error(READER_MESSAGES.missingDocument);

    expect(describeOpenError(error)).toBe(READER_MESSAGES.missingDocument);
  });

  it('falls back to the generic cannotOpen message for anything else', () => {
    expect(describeOpenError(new Error('unexpected'))).toBe(PDF_FILE_MESSAGES.cannotOpen);
    expect(describeOpenError('not an error')).toBe(PDF_FILE_MESSAGES.cannotOpen);
  });
});

describe('describeSaveError', () => {
  it('passes through a DocumentUnavailableError message', () => {
    const error = new DocumentUnavailableError();

    expect(describeSaveError(error)).toBe(error.message);
  });

  it('passes through a DocumentPermissionDeniedError message', () => {
    const error = new DocumentPermissionDeniedError();

    expect(describeSaveError(error)).toBe(error.message);
  });

  it('falls back to the generic saveFailed message for anything else', () => {
    expect(describeSaveError(new Error('unexpected'))).toBe(READER_MESSAGES.saveFailed);
  });
});
