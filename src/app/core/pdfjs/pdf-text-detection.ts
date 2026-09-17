import { PDFDocumentProxy } from 'pdfjs-dist';

const PAGES_TO_INSPECT = 3;

/** `false` when none of the first pages contains text (scanned document). */
export async function hasSelectableText(pdfDocument: PDFDocumentProxy): Promise<boolean> {
  const pagesToInspect = Math.min(PAGES_TO_INSPECT, pdfDocument.numPages);
  for (let pageNumber = 1; pageNumber <= pagesToInspect; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const hasText = content.items.some((item) => 'str' in item && item.str.trim().length > 0);
    if (hasText) {
      return true;
    }
  }
  return false;
}
