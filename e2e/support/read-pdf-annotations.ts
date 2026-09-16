import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface HighlightAnnotation {
  pageNumber: number;
  subtype: string;
  color: number[] | null;
  quadPointsCount: number;
}

/**
 * Opens a saved PDF with PDF.js in a separate Node process and returns its
 * highlight annotations, so the suite asserts what was written to the file
 * instead of what the viewer shows.
 */
export async function readHighlightAnnotations(pdfPath: string): Promise<HighlightAnnotation[]> {
  const script = join(__dirname, 'read-annotations.mjs');
  const { stdout } = await execFileAsync(process.execPath, [script, pdfPath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(stdout) as HighlightAnnotation[];
}
