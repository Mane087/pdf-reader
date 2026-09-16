const COPY_SUFFIX = '-highlighted';

/**
 * `clean-code.pdf` → `clean-code-highlighted.pdf`. The suffix is never duplicated.
 */
export function toHighlightedCopyName(fileName: string): string {
  const trimmed = fileName.trim() || 'documento.pdf';
  const extensionIndex = trimmed.toLowerCase().lastIndexOf('.pdf');
  const baseName = extensionIndex > 0 ? trimmed.slice(0, extensionIndex) : trimmed;
  const baseWithSuffix = baseName.endsWith(COPY_SUFFIX) ? baseName : `${baseName}${COPY_SUFFIX}`;
  return `${baseWithSuffix}.pdf`;
}
