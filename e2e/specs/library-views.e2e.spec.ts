import { expect, test } from '@playwright/test';

import { backToLibrary, openDocument } from '../support/app';

const listButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Ver como lista' });
const previewButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Ver con vista previa' });

test.describe('Library views', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openDocument(page, 'multi-page.pdf');
    await backToLibrary(page);
  });

  test('starts on the list view', async ({ page }) => {
    await expect(listButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(previewButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('img[src^="data:image"]')).toHaveCount(0);
  });

  test('shows the first page of each document in the preview view', async ({ page }) => {
    await previewButton(page).click();

    const thumbnail = page.locator('img[src^="data:image"]');
    await expect(thumbnail).toHaveCount(1);
    await expect(thumbnail).toBeVisible();
    // A rendered page is wider than it is tall only when rotated; here it must have a real size.
    const box = await thumbnail.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(50);
    expect(box?.height ?? 0).toBeGreaterThan(50);
    await expect(page.getByText('multi-page.pdf')).toBeVisible();
  });

  test('opens a document from the preview view', async ({ page }) => {
    await previewButton(page).click();

    await page.getByRole('button', { name: /^multi-page\.pdf/ }).click();

    await page.waitForURL(/\/reader\//);
    await expect(page.getByRole('heading', { name: 'multi-page.pdf' })).toBeVisible();
  });

  test('deletes a document from the preview view', async ({ page }) => {
    await previewButton(page).click();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Eliminar multi-page.pdf' }).click();

    await expect(
      page.getByText('Todavía no hay documentos. Agrega un PDF para empezar.'),
    ).toBeVisible();
  });

  test('renders the thumbnail of documents stored before previews existed', async ({ page }) => {
    // Simulates a record saved by an earlier version of the application.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open('pdf-reader');
          open.onerror = () => reject(new Error(String(open.error)));
          open.onsuccess = () => {
            const database = open.result;
            const store = database.transaction('documents', 'readwrite').objectStore('documents');
            const all = store.getAll();
            all.onsuccess = () => {
              for (const document of all.result) {
                delete document.thumbnailDataUrl;
                store.put(document);
              }
            };
            store.transaction.oncomplete = () => {
              database.close();
              resolve();
            };
            store.transaction.onerror = () => reject(new Error(String(store.transaction.error)));
          };
        }),
    );
    await page.reload();

    await previewButton(page).click();

    await expect(page.locator('img[src^="data:image"]')).toHaveCount(1, { timeout: 15_000 });
  });

  test('keeps the chosen view after reloading', async ({ page }) => {
    await previewButton(page).click();
    await expect(previewButton(page)).toHaveAttribute('aria-pressed', 'true');

    await page.reload();

    await expect(previewButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('img[src^="data:image"]')).toHaveCount(1);

    await listButton(page).click();
    await page.reload();

    await expect(listButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('img[src^="data:image"]')).toHaveCount(0);
  });
});
