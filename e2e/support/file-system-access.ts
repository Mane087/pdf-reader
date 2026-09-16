import { readFile } from 'node:fs/promises';

import { Page } from '@playwright/test';

import { fixturePath } from './app';

/**
 * Chromium only. `showOpenFilePicker` cannot be driven from the operating
 * system, so it is replaced by an implementation backed by the Origin Private
 * File System: the handle it returns is a real `FileSystemFileHandle`, which
 * means `createWritable`, `queryPermission` and storing it in IndexedDB are
 * exercised for real.
 *
 * The init script runs again on every navigation, so the file is only written
 * the first time; later reloads reuse whatever the application saved.
 */
export async function installFileSystemAccessMock(page: Page, fixtureName: string): Promise<void> {
  const base64 = (await readFile(fixturePath(fixtureName))).toString('base64');
  await page.addInitScript(
    ({ fileName, contents }) => {
      const decode = (value: string) =>
        Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
      const filePromise = (async () => {
        const root = await navigator.storage.getDirectory();
        try {
          return await root.getFileHandle(fileName);
        } catch {
          const handle = await root.getFileHandle(fileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(decode(contents));
          await writable.close();
          return handle;
        }
      })();
      const globalWindow = window as unknown as Record<string, unknown>;
      globalWindow['showOpenFilePicker'] = async () => [await filePromise];
      globalWindow['showSaveFilePicker'] = async (options?: { suggestedName?: string }) => {
        const root = await navigator.storage.getDirectory();
        return root.getFileHandle(options?.suggestedName ?? 'copy.pdf', { create: true });
      };
    },
    { fileName: fixtureName, contents: base64 },
  );
}

/**
 * Makes IndexedDB unavailable so the application runs in session mode and keeps
 * the file handle in memory.
 *
 * Reason: this Chromium build terminates the page when an Origin Private File
 * System handle is read back from IndexedDB, which is how the mock supplies a
 * real handle. Session mode exercises the same read and write code against a
 * real handle; persisting handles across reloads stays a manual check.
 */
export async function disableIndexedDb(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
  });
}

/**
 * Reads back a file stored in the Origin Private File System.
 * A file that does not exist yet returns an empty buffer, so callers can poll
 * until the application writes it.
 */
export async function readOpfsFile(page: Page, fileName: string): Promise<Buffer> {
  const base64 = await page.evaluate(async (name) => {
    const root = await navigator.storage.getDirectory();
    let file: File;
    try {
      file = await (await root.getFileHandle(name)).getFile();
    } catch {
      return '';
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }, fileName);
  return Buffer.from(base64, 'base64');
}
