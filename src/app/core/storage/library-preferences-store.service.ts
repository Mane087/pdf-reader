import { Injectable, effect, signal } from '@angular/core';

import { readJsonFromLocalStorage, writeJsonToLocalStorage } from './local-storage.util';

export type LibraryViewMode = 'list' | 'preview';

export const LIBRARY_PREFERENCES_STORAGE_KEY = 'pdf-reader.library-preferences.v1';

export const DEFAULT_LIBRARY_VIEW_MODE: LibraryViewMode = 'list';

const VIEW_MODES: readonly LibraryViewMode[] = ['list', 'preview'];

export function parseStoredLibraryViewMode(value: unknown): LibraryViewMode {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_LIBRARY_VIEW_MODE;
  }
  const stored = (value as Record<string, unknown>)['viewMode'];
  return typeof stored === 'string' && (VIEW_MODES as readonly string[]).includes(stored)
    ? (stored as LibraryViewMode)
    : DEFAULT_LIBRARY_VIEW_MODE;
}

/** How the library lists documents. Persisted in `localStorage` like the other preferences. */
@Injectable({ providedIn: 'root' })
export class LibraryPreferencesStore {
  private readonly viewModeState = signal<LibraryViewMode>(
    parseStoredLibraryViewMode(readJsonFromLocalStorage(LIBRARY_PREFERENCES_STORAGE_KEY)),
  );

  readonly viewMode = this.viewModeState.asReadonly();

  constructor() {
    effect(() =>
      writeJsonToLocalStorage(LIBRARY_PREFERENCES_STORAGE_KEY, { viewMode: this.viewModeState() }),
    );
  }

  setViewMode(viewMode: LibraryViewMode): void {
    this.viewModeState.set(viewMode);
  }
}
