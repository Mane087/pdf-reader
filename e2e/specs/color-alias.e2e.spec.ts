import { expect, test } from '@playwright/test';

import { highlightToolbar, openDocument, selectTextInFirstPage } from '../support/app';

test.describe('Color aliases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows a new alias in the highlight toolbar and keeps it after reloading', async ({
    page,
  }) => {
    await openDocument(page, 'single-page.pdf');

    await page.getByRole('button', { name: 'Alias' }).click();
    const yellowInput = page.locator('app-color-alias-settings input').first();
    await yellowInput.fill('Para el examen');
    await yellowInput.blur();
    await page
      .locator('app-color-alias-settings')
      .getByRole('button', { name: 'Cerrar', exact: true })
      .click();
    await expect(page.locator('app-color-alias-settings')).toHaveCount(0);

    await selectTextInFirstPage(page);
    await expect(
      highlightToolbar(page).getByRole('button', { name: 'Para el examen' }),
    ).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Alias' }).click();
    await expect(page.locator('app-color-alias-settings input').first()).toHaveValue(
      'Para el examen',
    );
  });

  test('falls back to the color name when the alias is left empty', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');

    await page.getByRole('button', { name: 'Alias' }).click();
    const blueInput = page.locator('app-color-alias-settings input').nth(2);
    await blueInput.fill('   ');
    await blueInput.blur();

    await expect(blueInput).toHaveValue('Azul');
  });

  test('restores the default aliases', async ({ page }) => {
    await openDocument(page, 'single-page.pdf');

    await page.getByRole('button', { name: 'Alias' }).click();
    const greenInput = page.locator('app-color-alias-settings input').nth(1);
    await greenInput.fill('Otra cosa');
    await greenInput.blur();
    await expect(greenInput).toHaveValue('Otra cosa');

    await page
      .locator('app-color-alias-settings')
      .getByRole('button', { name: 'Restablecer' })
      .click();

    await expect(greenInput).toHaveValue('Definición');
  });
});
