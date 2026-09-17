import type { PDFDocumentProxy } from 'pdfjs-dist';

/** Width in CSS pixels of the generated thumbnail; the height follows the page ratio. */
export const THUMBNAIL_WIDTH_PX = 320;

const THUMBNAIL_MIME_TYPE = 'image/jpeg';
const THUMBNAIL_QUALITY = 0.8;

/**
 * Renders the first page as a data URL to show it in the library.
 *
 * A data URL keeps the record self-contained: it is stored with the document in
 * IndexedDB and can be bound directly in a template, with no object URL to
 * release. Returns `null` when the page cannot be rendered, and the library
 * falls back to a generic icon.
 */
export async function renderFirstPageThumbnail(
  pdfDocument: PDFDocumentProxy,
  widthPx = THUMBNAIL_WIDTH_PX,
): Promise<string | null> {
  try {
    const page = await pdfDocument.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: widthPx / unscaledViewport.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));

    // Pages are transparent, so without a background the thumbnail turns black.
    await page.render({ canvas, viewport, background: '#FFFFFF' }).promise;
    return canvas.toDataURL(THUMBNAIL_MIME_TYPE, THUMBNAIL_QUALITY);
  } catch {
    return null;
  }
}
