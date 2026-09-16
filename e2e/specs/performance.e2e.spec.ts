import { expect, test } from '@playwright/test';

import { addDocument, backToLibrary, waitForViewerReady } from '../support/app';

/** Exit criterion of the spike: the first page of a 300+ page document in under 3 seconds. */
const FIRST_PAGE_BUDGET_MS = 3000;

test.describe('Performance', () => {
  test('shows the first page of a 320 page document within the budget', async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.goto('/');
    await addDocument(page, 'large-320-pages.pdf');
    await page.waitForURL(/\/reader\//);
    await waitForViewerReady(page);
    await expect(page.getByTestId('page-indicator')).toHaveText('Página 1 / 320');

    // Measure reopening the document, which is the path a reader takes every day.
    await backToLibrary(page);
    await page.reload();
    const documentButton = page.getByRole('button', { name: /^large-320-pages\.pdf/ });
    await expect(documentButton).toBeVisible();

    const startedAt = Date.now();
    await documentButton.click();
    await page.waitForURL(/\/reader\//);
    await page
      .locator('.pdfViewer .page[data-page-number="1"] canvas')
      .first()
      .waitFor({ state: 'attached' });
    const elapsedMs = Date.now() - startedAt;

    await testInfo.attach('first-page-ms.txt', {
      body: String(elapsedMs),
      contentType: 'text/plain',
    });
    expect(elapsedMs, `first page rendered in ${elapsedMs} ms`).toBeLessThan(FIRST_PAGE_BUDGET_MS);
  });
});
