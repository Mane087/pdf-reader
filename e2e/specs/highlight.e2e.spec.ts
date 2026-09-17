import { expect, test } from '@playwright/test';

import {
  backToLibrary,
  highlightCount,
  highlightToolbar,
  openDocument,
  selectTextInFirstPage,
} from '../support/app';
import { readHighlightAnnotations } from '../support/read-pdf-annotations';

test.describe('Highlights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the color toolbar with the configured aliases when text is selected', async ({
    page,
  }) => {
    await openDocument(page, 'single-page.pdf');

    await selectTextInFirstPage(page);

    const toolbar = highlightToolbar(page);
    await expect(toolbar.getByRole('button', { name: 'Tema importante' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Definición' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Ejemplo' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Repasar tema' })).toBeVisible();
  });

  test('creates a highlight and enables saving', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();

    await selectTextInFirstPage(page);
    await page
      .locator('app-highlight-toolbar')
      .getByRole('button', { name: 'Tema importante' })
      .click();

    await expect(highlightCount(page)).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled();
    await expect(page.getByTitle('Cambios sin guardar')).toBeVisible();
  });

  test('creates several highlights with different colors', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');

    await selectTextInFirstPage(page, 1);
    await page
      .locator('app-highlight-toolbar')
      .getByRole('button', { name: 'Tema importante' })
      .click();
    await expect(highlightCount(page)).toHaveCount(1);

    await selectTextInFirstPage(page, 2);
    await highlightToolbar(page).getByRole('button', { name: 'Ejemplo' }).click();
    await expect(highlightCount(page)).toHaveCount(2);
  });

  test('saves the highlight into the downloaded file as a standard annotation', async ({
    page,
  }) => {
    await openDocument(page, 'single-page.pdf');
    await selectTextInFirstPage(page);
    await page
      .locator('app-highlight-toolbar')
      .getByRole('button', { name: 'Tema importante' })
      .click();
    await expect(highlightCount(page)).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('single-page.pdf');
    await expect(page.getByRole('status')).toContainText(
      'Copia local actualizada y descarga iniciada.',
    );
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();

    const savedPath = await download.path();
    const annotations = await readHighlightAnnotations(savedPath);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].subtype).toBe('Highlight');
    expect(annotations[0].quadPointsCount).toBeGreaterThanOrEqual(1);
    // Yellow #FFFF98 = rgb(255, 255, 152).
    expect(annotations[0].color).toEqual([255, 255, 152]);
  });

  test('keeps the highlights when the saved copy is reopened', async ({ page }, testInfo) => {
    await openDocument(page, 'single-page.pdf');
    await selectTextInFirstPage(page);
    await highlightToolbar(page).getByRole('button', { name: 'Definición' }).click();
    await expect(highlightCount(page)).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const download = await downloadPromise;
    // The temporary download path has no extension, so it is saved under its real name.
    const savedPath = testInfo.outputPath('saved-copy.pdf');
    await download.saveAs(savedPath);

    await backToLibrary(page);
    await page.locator('app-document-dropzone input[type="file"]').setInputFiles(savedPath);
    await page.waitForURL(/\/reader\//);

    await expect(
      page
        .locator(
          '.pdfViewer .page section.highlightAnnotation, .annotationLayer .highlightAnnotation',
        )
        .first(),
    ).toBeAttached({
      timeout: 30_000,
    });
  });

  test('warns that a scanned document has no selectable text', async ({ page }) => {
    await openDocument(page, 'scanned.pdf');

    await expect(page.getByRole('status')).toContainText(
      'Este documento no contiene texto seleccionable.',
    );
  });

  test('creates an aligned highlight on a rotated page', async ({ page }) => {
    await openDocument(page, 'rotated-90.pdf');

    await selectTextInFirstPage(page);
    await page
      .locator('app-highlight-toolbar')
      .getByRole('button', { name: 'Repasar tema' })
      .click();

    await expect(highlightCount(page)).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const download = await downloadPromise;
    const annotations = await readHighlightAnnotations(await download.path());
    expect(annotations).toHaveLength(1);
  });
});
