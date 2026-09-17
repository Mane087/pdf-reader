import { expect, test } from '@playwright/test';

import {
  fixturePath,
  highlightCount,
  highlightToolbar,
  openDocument,
  selectTextInFirstPage,
} from '../support/app';
import { verifyWithExternalReaders } from '../support/external-readers';

/** Yellow #FFFF98. Rendering rounds the blue channel, so a small tolerance is allowed. */
const YELLOW = [255, 255, 152];

test.describe('Saved file in external readers', () => {
  test('writes a standard highlight that other PDF engines can parse and render', async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    await openDocument(page, 'single-page.pdf');
    await selectTextInFirstPage(page, 1);
    await highlightToolbar(page).getByRole('button', { name: 'Tema importante' }).click();
    await expect(highlightCount(page)).toHaveCount(1);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    const savedPath = testInfo.outputPath('saved.pdf');
    await (await downloadPromise).saveAs(savedPath);

    const report = await verifyWithExternalReaders(fixturePath('single-page.pdf'), savedPath);
    await testInfo.attach('external-readers.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    // pdf-lib: the annotation is a standard highlight with its appearance stream.
    expect(report.annotations).toHaveLength(1);
    expect(report.annotations[0].quadPointsCount).toBe(1);
    expect(report.annotations[0].color).toEqual(YELLOW);
    expect(report.annotations[0].hasAppearanceStream).toBe(true);

    // Ghostscript and Poppler: the highlight is visible in the rendered page.
    const renderers = Object.entries(report.renderers);
    expect(renderers.length, 'at least two external renderers available').toBeGreaterThanOrEqual(2);
    for (const [name, comparison] of renderers) {
      expect(comparison.changedPixels, `${name} renders the highlight`).toBeGreaterThan(1000);
      const [red, green, blue] = comparison.dominantColor ?? [0, 0, 0];
      expect(red, `${name} red channel`).toBe(YELLOW[0]);
      expect(green, `${name} green channel`).toBe(YELLOW[1]);
      expect(Math.abs(blue - YELLOW[2]), `${name} blue channel`).toBeLessThanOrEqual(2);
    }
  });
});
