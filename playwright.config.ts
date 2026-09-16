import { defineConfig, devices } from '@playwright/test';

const PORT = 4300;

/**
 * Most of the suite runs on Firefox, which has no File System Access API: the
 * application falls back to keeping a copy in IndexedDB and downloading the
 * file when saving. The `*.chromium.e2e.spec.ts` specs cover the opposite
 * path, writing over the original file through a real file handle.
 */
export default defineConfig({
  testDir: './e2e/specs',
  testMatch: '**/*.e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: '**/*.chromium.e2e.spec.ts',
    },
    {
      // File System Access only exists in Chromium; those specs run there.
      // `channel: 'chromium'` uses the full browser instead of the headless
      // shell, which is what File System Access needs.
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: ['--disable-gpu', '--use-gl=swiftshader', '--disable-dev-shm-usage'],
        },
      },
      testMatch: '**/*.chromium.e2e.spec.ts',
    },
  ],
  webServer: {
    command: `pnpm exec ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
