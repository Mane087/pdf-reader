export const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const PDF_FILE_MESSAGES = {
  tooLarge: `El archivo supera el máximo permitido de ${formatFileSize(MAX_PDF_FILE_SIZE_BYTES)}.`,
  notPdf: 'El archivo seleccionado no es un PDF.',
  cannotOpen: 'No fue posible abrir este archivo PDF.',
  password: 'Este PDF está protegido con contraseña y no es compatible en esta versión.',
  noStorageSpace: 'No hay espacio suficiente en el navegador para guardar una copia del archivo.',
} as const;

export type PdfFileValidationReason = 'too-large' | 'not-pdf' | 'invalid-header';

export class PdfFileValidationError extends Error {
  constructor(readonly reason: PdfFileValidationReason) {
    super(reason === 'too-large' ? PDF_FILE_MESSAGES.tooLarge : PDF_FILE_MESSAGES.notPdf);
    this.name = 'PdfFileValidationError';
  }
}

export interface PdfFileMetadata {
  name: string;
  size: number;
  type: string;
}

const PDF_HEADER = '%PDF-';
const HEADER_SEARCH_LENGTH = 1024;

/** Synchronous checks that do not require reading the file: size first, then extension or MIME type. */
export function validatePdfFileMetadata(file: PdfFileMetadata): PdfFileValidationReason | null {
  if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
    return 'too-large';
  }
  const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
  const hasPdfMimeType = file.type === 'application/pdf';
  if (!hasPdfExtension && !hasPdfMimeType) {
    return 'not-pdf';
  }
  return null;
}

/** The `%PDF-` marker must appear within the first bytes of the file. */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  const searchLength = Math.min(bytes.length, HEADER_SEARCH_LENGTH);
  const head = String.fromCharCode(...bytes.subarray(0, searchLength));
  return head.includes(PDF_HEADER);
}

/** Full validation. Throws `PdfFileValidationError` when the file is rejected. */
export async function validatePdfFile(file: File): Promise<void> {
  const metadataReason = validatePdfFileMetadata(file);
  if (metadataReason) {
    throw new PdfFileValidationError(metadataReason);
  }
  const headBuffer = await file.slice(0, HEADER_SEARCH_LENGTH).arrayBuffer();
  if (!hasPdfHeader(new Uint8Array(headBuffer))) {
    throw new PdfFileValidationError('invalid-header');
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 100 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
