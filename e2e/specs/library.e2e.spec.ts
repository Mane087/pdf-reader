import { expect, test } from '@playwright/test';

import { addDocument, backToLibrary, fixturePath, openDocument } from '../support/app';

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('adds a PDF and opens it in the reader', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');

    await expect(page.getByRole('heading', { name: 'single-page.pdf' })).toBeVisible();
    await expect(page.getByTestId('page-indicator')).toHaveText('Página 1 / 1');
  });

  test('keeps the added document after reloading the page', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');
    await backToLibrary(page);
    await expect(page.getByRole('button', { name: /^multi-page\.pdf/ })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('button', { name: /^multi-page\.pdf/ })).toBeVisible();
    await expect(page.getByText('6 páginas')).toBeVisible();
  });

  test('reopens a stored document from the library', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');
    await backToLibrary(page);
    await page.reload();

    await page.getByRole('button', { name: /^multi-page\.pdf/ }).click();

    await page.waitForURL(/\/reader\//);
    await expect(page.getByRole('heading', { name: 'multi-page.pdf' })).toBeVisible();
  });

  test('removes a document after confirmation and keeps the library empty', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');
    await backToLibrary(page);

    const deleteButton = page.getByRole('button', { name: 'Eliminar single-page.pdf' });
    // A missing asset would render an empty box, so this also guards the icon path.
    await expect(deleteButton.locator('img')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await deleteButton.click();

    await expect(
      page.getByText('Todavía no hay documentos. Agrega un PDF para empezar.'),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText('Todavía no hay documentos. Agrega un PDF para empezar.'),
    ).toBeVisible();
  });

  test('rejects a file that exceeds the size limit', async ({ page }) => {
    await page
      .locator('app-document-dropzone input[type="file"]')
      .setInputFiles(fixturePath('oversized.pdf'));

    await expect(page.getByRole('alert')).toContainText(
      'El archivo supera el máximo permitido de 50.0 MB.',
    );
    await expect(page).toHaveURL(/\/$/);
  });

  test('rejects a file that is not a PDF', async ({ page }) => {
    await addDocument(page, 'not-a-pdf.pdf');

    await expect(page.getByRole('alert')).toContainText('El archivo seleccionado no es un PDF.');
    await expect(page).toHaveURL(/\/$/);
  });
});
