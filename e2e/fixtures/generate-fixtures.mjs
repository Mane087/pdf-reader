/**
 * Generates the PDF fixtures used by the Playwright suite.
 * Run with `pnpm run e2e:fixtures`; the output is git-ignored.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'generated');

const LINES = [
  'The quick brown fox jumps over the lazy dog.',
  'Highlighting turns selected text into a PDF annotation.',
  'Each color carries a meaning defined by the reader.',
  'Annotations survive in any standards compliant viewer.',
];

async function createTextDocument({ pageCount, rotation = 0 }) {
  const pdfDocument = await PDFDocument.create();
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdfDocument.addPage([595, 842]);
    if (rotation !== 0) {
      page.setRotation(degrees(rotation));
    }
    page.drawText(`Page ${pageIndex + 1}`, { x: 60, y: 780, size: 24, font, color: rgb(0, 0, 0) });
    LINES.forEach((line, lineIndex) => {
      page.drawText(line, { x: 60, y: 720 - lineIndex * 32, size: 14, font, color: rgb(0, 0, 0) });
    });
  }
  return pdfDocument.save();
}

/** A page with only a drawn rectangle: no text layer, so it cannot be highlighted. */
async function createScannedDocument() {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([595, 842]);
  page.drawRectangle({ x: 80, y: 500, width: 420, height: 220, color: rgb(0.85, 0.85, 0.85) });
  return pdfDocument.save();
}

/**
 * A valid PDF padded past the 50 MB limit. Written to disk (not committed) so
 * the test can pass a path instead of pushing 50 MB through the protocol.
 */
async function createOversizedDocument(limitBytes) {
  const base = await createTextDocument({ pageCount: 1 });
  const padding = new Uint8Array(limitBytes + 1 - base.length).fill(0x20); // spaces after %%EOF
  const oversized = new Uint8Array(base.length + padding.length);
  oversized.set(base, 0);
  oversized.set(padding, base.length);
  return oversized;
}

const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024;

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const fixtures = [
    ['single-page.pdf', await createTextDocument({ pageCount: 1 })],
    ['multi-page.pdf', await createTextDocument({ pageCount: 6 })],
    ['rotated-90.pdf', await createTextDocument({ pageCount: 2, rotation: 90 })],
    ['rotated-180.pdf', await createTextDocument({ pageCount: 2, rotation: 180 })],
    ['rotated-270.pdf', await createTextDocument({ pageCount: 2, rotation: 270 })],
    ['scanned.pdf', await createScannedDocument()],
    ['not-a-pdf.pdf', new TextEncoder().encode('This file has a .pdf name but no PDF header.')],
    ['oversized.pdf', await createOversizedDocument(MAX_PDF_FILE_SIZE_BYTES)],
    ['large-320-pages.pdf', await createTextDocument({ pageCount: 320 })],
  ];
  for (const [name, bytes] of fixtures) {
    await writeFile(join(OUTPUT_DIR, name), bytes);
  }
  console.log(`Generated ${fixtures.length} fixtures in ${OUTPUT_DIR}`);
}

await main();
