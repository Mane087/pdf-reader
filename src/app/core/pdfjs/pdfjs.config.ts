import {
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  PDFDocumentProxy,
  getDocument,
} from 'pdfjs-dist';

/** Assets copied by angular.json from node_modules/pdfjs-dist. */
export const PDFJS_WORKER_SRC = 'pdfjs/pdf.worker.min.mjs';

export const PDFJS_DOCUMENT_OPTIONS = {
  cMapUrl: 'pdfjs/cmaps/',
  standardFontDataUrl: 'pdfjs/standard_fonts/',
  wasmUrl: 'pdfjs/wasm/',
  iccUrl: 'pdfjs/iccs/',
  enableXfa: false,
} as const;

export type PdfLoadFailureReason = 'password' | 'invalid' | 'unknown';

export class PdfLoadError extends Error {
  constructor(
    readonly reason: PdfLoadFailureReason,
    override readonly cause: unknown,
  ) {
    super(`PDF load failed: ${reason}`);
    this.name = 'PdfLoadError';
  }
}

export function configurePdfjsWorker(): void {
  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  }
}

/**
 * Parses `bytes` in the PDF.js worker. The buffer is transferred to the worker,
 * so callers must not reuse it afterwards.
 */
export async function loadPdfDocument(bytes: Uint8Array<ArrayBuffer>): Promise<PDFDocumentProxy> {
  configurePdfjsWorker();
  const loadingTask = getDocument({ data: bytes, ...PDFJS_DOCUMENT_OPTIONS });
  try {
    return await loadingTask.promise;
  } catch (error) {
    throw new PdfLoadError(classifyLoadError(error), error);
  }
}

function classifyLoadError(error: unknown): PdfLoadFailureReason {
  if (error instanceof PasswordException || hasErrorName(error, 'PasswordException')) {
    return 'password';
  }
  if (error instanceof InvalidPDFException || hasErrorName(error, 'InvalidPDFException')) {
    return 'invalid';
  }
  return 'unknown';
}

function hasErrorName(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === name;
}
