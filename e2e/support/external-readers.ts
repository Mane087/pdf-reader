import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface RendererComparison {
  changedPixels: number;
  dominantColor: number[] | null;
  dominantColorPixels: number;
}

export interface ExternalReaderAnnotation {
  pageIndex: number;
  quadPointsCount: number;
  color: number[] | null;
  hasAppearanceStream: boolean;
}

export interface ExternalReadersReport {
  annotations: ExternalReaderAnnotation[];
  renderers: { ghostscript?: RendererComparison; poppler?: RendererComparison };
}

/**
 * Checks a saved PDF with engines unrelated to PDF.js: pdf-lib parses the
 * annotations, and Ghostscript and Poppler render the page so the highlight
 * can be seen in the resulting pixels.
 */
export async function verifyWithExternalReaders(
  originalPath: string,
  savedPath: string,
): Promise<ExternalReadersReport> {
  const script = join(__dirname, 'verify-external-readers.mjs');
  const { stdout } = await execFileAsync(process.execPath, [script, originalPath, savedPath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as ExternalReadersReport;
}
