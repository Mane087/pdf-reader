import { join } from 'node:path';

import { Page, expect } from '@playwright/test';

// Playwright transpiles the suite to CommonJS, so `__dirname` is the portable option here.
export const FIXTURES_DIR = join(__dirname, '..', 'fixtures', 'generated');

export function fixturePath(name: string): string {
  return join(FIXTURES_DIR, name);
}

/** Adds a PDF through the hidden file input of the dropzone (the Firefox path). */
export async function addDocument(page: Page, fixtureName: string): Promise<void> {
  await page
    .locator('app-document-dropzone input[type="file"]')
    .setInputFiles(fixturePath(fixtureName));
}

/** Adds a document and waits until the reader finished loading it. */
export async function openDocument(page: Page, fixtureName: string): Promise<void> {
  await addDocument(page, fixtureName);
  await page.waitForURL(/\/reader\//);
  await waitForViewerReady(page);
}

export async function waitForViewerReady(page: Page): Promise<void> {
  await expect(page.getByText('Cargando documento…')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.pdfViewer .page .textLayer').first()).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: 'Aumentar zoom' })).toBeEnabled();
}

/** Goes back to the library from the reader. */
export async function backToLibrary(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Volver a la biblioteca' }).click();
}

export function pageIndicator(page: Page) {
  return page.getByTestId('page-indicator');
}

/** Reads "Página 3 / 6" and returns 3. */
export async function currentPageNumber(page: Page): Promise<number> {
  const text = (await pageIndicator(page).innerText()).trim();
  return Number(
    text
      .replace(/^Página\s+/, '')
      .split('/')[0]
      .trim(),
  );
}

/**
 * Selects the text of one line inside the first rendered text layer.
 * PDF.js reads `document.getSelection()`, so a programmatic selection is
 * equivalent to a drag for the purposes of creating a highlight.
 */
export async function selectTextInFirstPage(page: Page, lineIndex = 1): Promise<void> {
  await page.evaluate((index) => {
    const textLayer = document.querySelector('.pdfViewer .page .textLayer');
    if (!textLayer) {
      throw new Error('No text layer rendered');
    }
    const spans = [...textLayer.querySelectorAll('span')].filter((span) =>
      span.textContent?.trim(),
    );
    const span = spans[index] ?? spans[0];
    if (!span) {
      throw new Error('The text layer has no text spans');
    }
    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, lineIndex);
  await expect(highlightToolbar(page)).toBeVisible();
}

/**
 * The floating toolbar. The `app-highlight-toolbar` host has no box of its own
 * because its content is positioned fixed, so the element with the toolbar role
 * is the one to assert on.
 */
export function highlightToolbar(page: Page) {
  return page.getByRole('toolbar');
}

export function highlightCount(page: Page) {
  // PDF.js renders each highlight editor as a div with the editor name as class.
  return page.locator('.annotationEditorLayer .highlightEditor');
}
