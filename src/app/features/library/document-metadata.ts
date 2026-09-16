import { formatFileSize } from '../../core/files/pdf-file-validation';
import { formatRelativeDate } from '../../core/files/relative-date';
import { StoredDocument } from '../../core/models/stored-document.model';

/** "1.7 MB · 188 páginas · hace 3 minutos" */
export function documentMetadata(document: StoredDocument): string {
  return [formatFileSize(document.sizeBytes), ...pagesAndDate(document)].join(' · ');
}

/** "188 páginas · hace 3 minutos": the file size does not fit in a tile. */
export function documentPreviewMetadata(document: StoredDocument): string {
  return pagesAndDate(document).join(' · ');
}

function pagesAndDate(document: StoredDocument): string[] {
  const pageCount = document.pageCount;
  const parts = pageCount ? [`${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`] : [];
  parts.push(formatRelativeDate(document.lastOpenedAt));
  return parts;
}
