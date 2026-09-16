import { writeFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  fixturePath,
  highlightCount,
  highlightToolbar,
  selectTextInFirstPage,
  waitForViewerReady,
} from '../support/app';
import { verifyWithExternalReaders } from '../support/external-readers';
import {
  disableIndexedDb,
  installFileSystemAccessMock,
  readOpfsFile,
} from '../support/file-system-access';

const FIXTURE = 'single-page.pdf';
const YELLOW = [255, 255, 152];

async function addThroughPicker(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: '+ Agregar PDF' }).click();
  await page.waitForURL(/\/reader\//);
  await waitForViewerReady(page);
}

test.describe('File System Access (Chromium)', () => {
  test.beforeEach(async ({ page }) => {
    await installFileSystemAccessMock(page, FIXTURE);
    await disableIndexedDb(page);
    await page.goto('/');
  });

  test('the picker returns a real handle with read and write permission', async ({ page }) => {
    const handleInfo = await page.evaluate(async () => {
      const [handle] = await window.showOpenFilePicker();
      return {
        kind: handle.kind,
        name: handle.name,
        read: await handle.queryPermission({ mode: 'read' }),
        readwrite: await handle.queryPermission({ mode: 'readwrite' }),
      };
    });

    expect(handleInfo).toEqual({
      kind: 'file',
      name: FIXTURE,
      read: 'granted',
      readwrite: 'granted',
    });
  });

  test('opens a document from the handle and offers to write in place', async ({ page }) => {
    await addThroughPicker(page);

    await expect(page.getByRole('heading', { name: FIXTURE })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toHaveAttribute(
      'title',
      'Guardar sobre el mismo archivo',
    );
  });

  test('writes the highlight into the original file without downloading a copy', async ({
    page,
  }, testInfo) => {
    await addThroughPicker(page);
    const originalSize = (await readOpfsFile(page, FIXTURE)).length;

    await selectTextInFirstPage(page, 1);
    await highlightToolbar(page).getByRole('button', { name: 'Tema importante' }).click();
    await expect(highlightCount(page)).toHaveCount(1);

    let downloadStarted = false;
    page.on('download', () => {
      downloadStarted = true;
    });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page.getByText('Cambios guardados.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
    expect(downloadStarted, 'saving in place does not download a copy').toBe(false);

    const savedBytes = await readOpfsFile(page, FIXTURE);
    expect(savedBytes.length, 'the file on disk grew with the annotation').toBeGreaterThan(
      originalSize,
    );

    const savedPath = testInfo.outputPath('saved-in-place.pdf');
    await writeFile(savedPath, savedBytes);
    const report = await verifyWithExternalReaders(fixturePath(FIXTURE), savedPath);
    await testInfo.attach('external-readers.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    expect(report.annotations).toHaveLength(1);
    expect(report.annotations[0].color).toEqual(YELLOW);
    expect(report.annotations[0].hasAppearanceStream).toBe(true);
    for (const [name, comparison] of Object.entries(report.renderers)) {
      expect(comparison.changedPixels, `${name} renders the highlight`).toBeGreaterThan(1000);
    }
  });

  test('saves a copy under a new name and leaves the original untouched', async ({ page }) => {
    await addThroughPicker(page);
    const originalSize = (await readOpfsFile(page, FIXTURE)).length;

    await selectTextInFirstPage(page, 1);
    await highlightToolbar(page).getByRole('button', { name: 'Ejemplo' }).click();
    await expect(highlightCount(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Guardar como copia' }).click();

    await expect
      .poll(async () => (await readOpfsFile(page, 'single-page-highlighted.pdf')).length)
      .toBeGreaterThan(originalSize);
    expect((await readOpfsFile(page, FIXTURE)).length, 'the original is unchanged').toBe(
      originalSize,
    );
    // The copy is not the open document, so the pending changes are still pending.
    await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeEnabled();
  });
});
