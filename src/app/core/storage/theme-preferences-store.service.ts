import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

import { readJsonFromLocalStorage, writeJsonToLocalStorage } from './local-storage.util';

export type ThemePreference = 'light' | 'dark';

export const THEME_PREFERENCES_STORAGE_KEY = 'pdf-reader.theme-preferences.v1';

/** Class set on `<html>`. Tailwind's `dark:` variant is bound to it in `styles.css`. */
export const DARK_THEME_CLASS = 'dark';

export const DARK_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const THEMES: readonly ThemePreference[] = ['light', 'dark'];

/**
 * Reads the theme chosen by the user in a previous session. Returns `null` when
 * nothing valid is stored, so the caller can follow the operating system instead.
 */
export function parseStoredTheme(value: unknown): ThemePreference | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const stored = (value as Record<string, unknown>)['theme'];
  return typeof stored === 'string' && (THEMES as readonly string[]).includes(stored)
    ? (stored as ThemePreference)
    : null;
}

/** The theme requested by the operating system. Falls back to `light` where `matchMedia` is unavailable. */
export function readSystemTheme(): ThemePreference {
  return matchDarkColorScheme()?.matches ? 'dark' : 'light';
}

function matchDarkColorScheme(): MediaQueryList | null {
  try {
    return window.matchMedia(DARK_COLOR_SCHEME_QUERY);
  } catch {
    return null;
  }
}

/**
 * The active color theme. Until the user picks one it follows the operating
 * system; the first explicit choice is persisted and pins the theme from then on.
 */
@Injectable({ providedIn: 'root' })
export class ThemePreferencesStore {
  private readonly chosenTheme = signal<ThemePreference | null>(
    parseStoredTheme(readJsonFromLocalStorage(THEME_PREFERENCES_STORAGE_KEY)),
  );
  private readonly systemTheme = signal<ThemePreference>(readSystemTheme());

  readonly theme = computed<ThemePreference>(() => this.chosenTheme() ?? this.systemTheme());
  readonly isDarkTheme = computed(() => this.theme() === 'dark');

  constructor() {
    this.followSystemTheme();

    effect(() => {
      const chosen = this.chosenTheme();
      if (chosen !== null) {
        writeJsonToLocalStorage(THEME_PREFERENCES_STORAGE_KEY, { theme: chosen });
      }
    });

    effect(() => {
      document.documentElement.classList.toggle(DARK_THEME_CLASS, this.isDarkTheme());
    });
  }

  setTheme(theme: ThemePreference): void {
    this.chosenTheme.set(theme);
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /** Keeps the fallback in sync while no explicit choice has been made. */
  private followSystemTheme(): void {
    const query = matchDarkColorScheme();
    if (!query || typeof query.addEventListener !== 'function') {
      return;
    }
    const onChange = (event: MediaQueryListEvent) =>
      this.systemTheme.set(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', onChange));
  }
}
