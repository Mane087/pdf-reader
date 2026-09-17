import { Page, expect, test } from '@playwright/test';

import { backToLibrary, openDocument } from '../support/app';

const themeToggle = (page: Page) => page.getByTestId('theme-toggle');

function isDark(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.classList.contains('dark'));
}

test.describe('Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openDocument(page, 'multi-page.pdf');
  });

  test('follows the system setting until the user picks a theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => isDark(page)).toBe(true);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => isDark(page)).toBe(false);
  });

  test('switches the theme from the toolbar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(themeToggle(page)).toHaveAttribute('aria-label', 'Activar tema oscuro');

    await themeToggle(page).click();

    await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(themeToggle(page)).toHaveAttribute('aria-label', 'Activar tema claro');
    expect(await isDark(page)).toBe(true);
  });

  test('keeps the chosen theme after reloading and over the system setting', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await themeToggle(page).click();
    expect(await isDark(page)).toBe(true);

    await page.reload();

    await expect.poll(() => isDark(page)).toBe(true);
    await expect(themeToggle(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('keeps the theme when going back to the library', async ({ page }) => {
    await themeToggle(page).click();
    const wasDark = await isDark(page);

    await backToLibrary(page);

    await expect.poll(() => isDark(page)).toBe(wasDark);
  });

  test('offers a fullscreen toggle next to the theme toggle', async ({ page }) => {
    const fullscreenToggle = page.getByTestId('fullscreen-toggle');

    await expect(fullscreenToggle).toBeVisible();
    await expect(fullscreenToggle).toHaveAttribute('aria-label', 'Ver en pantalla completa');
    await expect(fullscreenToggle).toHaveAttribute('aria-pressed', 'false');
  });
});
