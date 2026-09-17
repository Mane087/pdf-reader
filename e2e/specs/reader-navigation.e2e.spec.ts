import { expect, test } from '@playwright/test';

import {
  backToLibrary,
  currentPageNumber,
  openDocument,
  pageIndicator,
  waitForViewerReady,
} from '../support/app';

test.describe('Reader navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('moves between pages with the arrow keys', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');
    await expect(pageIndicator(page)).toHaveText('Página 1 / 6');

    await page.keyboard.press('ArrowRight');
    await expect(pageIndicator(page)).toHaveText('Página 2 / 6');

    await page.keyboard.press('ArrowRight');
    await expect(pageIndicator(page)).toHaveText('Página 3 / 6');

    await page.keyboard.press('ArrowLeft');
    await expect(pageIndicator(page)).toHaveText('Página 2 / 6');
  });

  test('jumps to the last and first page with End and Home', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');

    await page.keyboard.press('End');
    await expect(pageIndicator(page)).toHaveText('Página 6 / 6');

    await page.keyboard.press('Home');
    await expect(pageIndicator(page)).toHaveText('Página 1 / 6');
  });

  test('does not change page while typing in the alias panel', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');
    await page.getByRole('button', { name: 'Alias' }).click();

    const aliasInput = page.locator('app-color-alias-settings input').first();
    await aliasInput.click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(pageIndicator(page)).toHaveText('Página 1 / 6');
  });

  test('shows two pages per spread and advances by spread', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await openDocument(page, 'multi-page.pdf');

    await page.getByRole('button', { name: 'Dos páginas' }).click();
    await expect(page.locator('.pdfViewer .spread').first()).toBeAttached();

    const firstPage = await currentPageNumber(page);
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => (await currentPageNumber(page)) - firstPage, {
        message: 'advances by a spread',
      })
      .toBeGreaterThanOrEqual(2);
  });

  test('disables the two-page mode on narrow viewports', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openDocument(page, 'multi-page.pdf');

    await expect(page.getByRole('button', { name: 'Dos páginas' })).toBeDisabled();
  });

  test('changes the zoom level', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');
    const zoomLabel = page.getByText(/^\d+%$/);
    const readZoom = async () => Number((await zoomLabel.innerText()).replace('%', ''));
    const initialZoom = await readZoom();

    await page.getByRole('button', { name: 'Aumentar zoom' }).click();
    await expect.poll(readZoom).toBeGreaterThan(initialZoom);
    // PDF.js snaps to preset levels, so zooming out does not return to the exact starting value.
    const zoomedIn = await readZoom();

    await page.getByRole('button', { name: 'Reducir zoom' }).click();
    await expect.poll(readZoom).toBeLessThan(zoomedIn);
  });

  test('reopens the document on the last page that was read', async ({ page }) => {
    await openDocument(page, 'multi-page.pdf');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(pageIndicator(page)).toHaveText('Página 3 / 6');
    // The last page is persisted with a debounce.
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              new Promise<number>((resolve) => {
                const request = indexedDB.open('pdf-reader');
                request.onsuccess = () => {
                  const database = request.result;
                  const store = database.transaction('documents').objectStore('documents');
                  const all = store.getAll();
                  all.onsuccess = () => {
                    resolve(all.result[0]?.lastPage ?? 0);
                    database.close();
                  };
                };
              }),
          ),
        { timeout: 10_000 },
      )
      .toBe(3);

    await backToLibrary(page);
    await page.getByRole('button', { name: /^multi-page\.pdf/ }).click();
    await waitForViewerReady(page);

    await expect(pageIndicator(page)).toHaveText('Página 3 / 6');
  });
});
