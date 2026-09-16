import {
  MAX_PDF_FILE_SIZE_BYTES,
  PDF_FILE_MESSAGES,
  PdfFileValidationError,
  formatFileSize,
  hasPdfHeader,
  validatePdfFile,
  validatePdfFileMetadata,
} from './pdf-file-validation';

describe('validatePdfFileMetadata', () => {
  it('rejects with "too-large" when the file exceeds the max size, even when the type is also wrong', () => {
    const result = validatePdfFileMetadata({
      name: 'notes.txt',
      size: MAX_PDF_FILE_SIZE_BYTES + 1,
      type: 'text/plain',
    });

    expect(result).toBe('too-large');
  });

  it('accepts a file with a .pdf extension regardless of its mime type', () => {
    const result = validatePdfFileMetadata({
      name: 'document.pdf',
      size: 1024,
      type: 'text/plain',
    });

    expect(result).toBeNull();
  });

  it('accepts a file with the application/pdf mime type regardless of its extension', () => {
    const result = validatePdfFileMetadata({
      name: 'document',
      size: 1024,
      type: 'application/pdf',
    });

    expect(result).toBeNull();
  });

  it('rejects with "not-pdf" when neither the extension nor the mime type match', () => {
    const result = validatePdfFileMetadata({
      name: 'document.txt',
      size: 1024,
      type: 'text/plain',
    });

    expect(result).toBe('not-pdf');
  });
});

describe('hasPdfHeader', () => {
  function bytesFrom(text: string): Uint8Array {
    return new Uint8Array([...text].map((char) => char.charCodeAt(0)));
  }

  it('returns true when the %PDF- marker appears within the first 1024 bytes', () => {
    const bytes = bytesFrom('%PDF-1.7\n%...');

    expect(hasPdfHeader(bytes)).toBe(true);
  });

  it('returns true when the marker appears after some leading bytes but still inside the search window', () => {
    const bytes = bytesFrom(`${'a'.repeat(100)}%PDF-1.7`);

    expect(hasPdfHeader(bytes)).toBe(true);
  });

  it('returns false when the marker is absent', () => {
    const bytes = bytesFrom('this is not a pdf file');

    expect(hasPdfHeader(bytes)).toBe(false);
  });

  it('returns false for an empty byte array', () => {
    expect(hasPdfHeader(new Uint8Array())).toBe(false);
  });
});

describe('validatePdfFile', () => {
  it('throws PdfFileValidationError with reason "too-large" for an oversized file', async () => {
    const file = new File([new Uint8Array(MAX_PDF_FILE_SIZE_BYTES + 1)], 'big.pdf', {
      type: 'application/pdf',
    });

    const rejection = validatePdfFile(file);

    await expect(rejection).rejects.toBeInstanceOf(PdfFileValidationError);
    await expect(rejection).rejects.toMatchObject({
      reason: 'too-large',
      message: PDF_FILE_MESSAGES.tooLarge,
    });
  });

  it('throws PdfFileValidationError with reason "not-pdf" when the extension and mime type do not match', async () => {
    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });

    await expect(validatePdfFile(file)).rejects.toMatchObject({
      reason: 'not-pdf',
      message: PDF_FILE_MESSAGES.notPdf,
    });
  });

  it('throws PdfFileValidationError with reason "invalid-header" when the content does not start with %PDF-', async () => {
    const file = new File(['not really a pdf'], 'document.pdf', { type: 'application/pdf' });

    await expect(validatePdfFile(file)).rejects.toMatchObject({ reason: 'invalid-header' });
  });

  it('resolves for a valid PDF file', async () => {
    const file = new File(['%PDF-1.7\n...'], 'document.pdf', { type: 'application/pdf' });

    await expect(validatePdfFile(file)).resolves.toBeUndefined();
  });
});

describe('formatFileSize', () => {
  it('formats sizes below 1024 bytes as bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes with one decimal when the value is below 100', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes with one decimal when the value is below 100', () => {
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('formats values of 100 or above without decimals', () => {
    expect(formatFileSize(1024 * 150)).toBe('150 KB');
  });
});
