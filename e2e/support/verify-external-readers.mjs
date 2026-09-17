/**
 * Verifies a saved PDF with engines that are independent from PDF.js:
 *
 *  - pdf-lib   parses the file and reports the /Highlight annotations.
 *  - Ghostscript and Poppler (pdftoppm) render page 1 of the original and of
 *    the saved file; the highlight must change pixels in both renders.
 *
 * Together they stand in for "the highlights are visible in external readers".
 *
 * Usage: node verify-external-readers.mjs <original.pdf> <saved.pdf>
 * Prints a JSON report on stdout.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { PDFDocument, PDFName, PDFNumber } from 'pdf-lib';

const execFileAsync = promisify(execFile);

/** Reads the /Highlight annotations with pdf-lib, a parser unrelated to PDF.js. */
async function readAnnotationsWithPdfLib(path) {
  const pdfDocument = await PDFDocument.load(await readFile(path), { updateMetadata: false });
  const highlights = [];
  pdfDocument.getPages().forEach((page, pageIndex) => {
    const annotations = page.node.Annots();
    if (!annotations) {
      return;
    }
    for (let index = 0; index < annotations.size(); index += 1) {
      const annotation = annotations.lookup(index);
      if (annotation?.get(PDFName.of('Subtype'))?.asString?.() !== '/Highlight') {
        continue;
      }
      const quadPoints = annotation.get(PDFName.of('QuadPoints'));
      const color = annotation.get(PDFName.of('C'));
      highlights.push({
        pageIndex,
        quadPointsCount: quadPoints ? quadPoints.size() / 8 : 0,
        color: color ? color.asArray().map((value) => Math.round(PDFNumber.prototype.asNumber.call(value) * 255)) : null,
        hasAppearanceStream: annotation.get(PDFName.of('AP')) !== undefined,
      });
    }
  });
  return highlights;
}

function parsePpm(buffer) {
  let offset = 0;
  const fields = [];
  const isSpace = (byte) => byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09;
  while (fields.length < 4) {
    while (isSpace(buffer[offset])) {
      offset += 1;
    }
    if (buffer[offset] === 0x23) {
      while (buffer[offset] !== 0x0a) {
        offset += 1;
      }
      continue;
    }
    const start = offset;
    while (offset < buffer.length && !isSpace(buffer[offset])) {
      offset += 1;
    }
    fields.push(buffer.subarray(start, offset).toString());
  }
  offset += 1;
  if (fields[0] !== 'P6') {
    throw new Error(`Unexpected PPM magic: ${fields[0]}`);
  }
  return { width: Number(fields[1]), height: Number(fields[2]), data: buffer.subarray(offset) };
}

/** Pixels that differ between the two renders, plus the most frequent resulting color. */
function comparePpm(originalBuffer, savedBuffer) {
  const original = parsePpm(originalBuffer);
  const saved = parsePpm(savedBuffer);
  if (original.width !== saved.width || original.height !== saved.height) {
    throw new Error('The two renders have different sizes');
  }
  const colors = new Map();
  let changedPixels = 0;
  for (let index = 0; index < original.width * original.height; index += 1) {
    const offset = index * 3;
    const isEqual =
      original.data[offset] === saved.data[offset] &&
      original.data[offset + 1] === saved.data[offset + 1] &&
      original.data[offset + 2] === saved.data[offset + 2];
    if (isEqual) {
      continue;
    }
    changedPixels += 1;
    const key = `${saved.data[offset]},${saved.data[offset + 1]},${saved.data[offset + 2]}`;
    colors.set(key, (colors.get(key) ?? 0) + 1);
  }
  const [dominant] = [...colors.entries()].sort((a, b) => b[1] - a[1]);
  return {
    changedPixels,
    dominantColor: dominant ? dominant[0].split(',').map(Number) : null,
    dominantColorPixels: dominant ? dominant[1] : 0,
  };
}

async function hasCommand(command) {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function renderWithGhostscript(pdfPath, outputPath) {
  await execFileAsync('gs', [
    '-q',
    '-dNOPAUSE',
    '-dBATCH',
    '-dSAFER',
    '-sDEVICE=ppmraw',
    '-r72',
    '-dFirstPage=1',
    '-dLastPage=1',
    `-sOutputFile=${outputPath}`,
    pdfPath,
  ]);
  return readFile(outputPath);
}

async function renderWithPoppler(pdfPath, outputPrefix) {
  await execFileAsync('pdftoppm', ['-r', '72', '-f', '1', '-l', '1', pdfPath, outputPrefix]);
  return readFile(`${outputPrefix}-1.ppm`);
}

async function main() {
  const [, , originalPath, savedPath] = process.argv;
  if (!originalPath || !savedPath) {
    throw new Error('Usage: node verify-external-readers.mjs <original.pdf> <saved.pdf>');
  }
  const workDir = await mkdtemp(join(tmpdir(), 'pdf-reader-verify-'));
  try {
    const report = { annotations: await readAnnotationsWithPdfLib(savedPath), renderers: {} };

    if (await hasCommand('gs')) {
      report.renderers.ghostscript = comparePpm(
        await renderWithGhostscript(originalPath, join(workDir, 'gs-original.ppm')),
        await renderWithGhostscript(savedPath, join(workDir, 'gs-saved.ppm')),
      );
    }
    if (await hasCommand('pdftoppm')) {
      report.renderers.poppler = comparePpm(
        await renderWithPoppler(originalPath, join(workDir, 'poppler-original')),
        await renderWithPoppler(savedPath, join(workDir, 'poppler-saved')),
      );
    }
    process.stdout.write(JSON.stringify(report));
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

await main();
