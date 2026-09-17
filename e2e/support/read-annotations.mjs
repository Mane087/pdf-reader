/**
 * Prints the highlight annotations of a PDF as JSON.
 * Runs as a separate Node process so the suite (transpiled to CommonJS by
 * Playwright) can use the ES module build of PDF.js without interop issues.
 *
 * Usage: node read-annotations.mjs <path-to-pdf>
 */
import { readFile } from 'node:fs/promises';

const [, , pdfPath] = process.argv;
if (!pdfPath) {
  throw new Error('Usage: node read-annotations.mjs <path-to-pdf>');
}

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await readFile(pdfPath)) });
const pdfDocument = await loadingTask.promise;
const highlights = [];

for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
  const page = await pdfDocument.getPage(pageNumber);
  for (const annotation of await page.getAnnotations()) {
    if (annotation.subtype !== 'Highlight') {
      continue;
    }
    const { quadPoints } = annotation;
    highlights.push({
      pageNumber,
      subtype: annotation.subtype,
      color: annotation.color ? Array.from(annotation.color) : null,
      // One quadrilateral (8 numbers) per highlighted line.
      quadPointsCount: quadPoints ? (Array.isArray(quadPoints) ? quadPoints.length : quadPoints.length / 8) : 0,
    });
  }
}

await loadingTask.destroy();
process.stdout.write(JSON.stringify(highlights));
