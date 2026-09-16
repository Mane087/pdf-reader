import { TestBed } from '@angular/core/testing';

import {
  DARK_COLOR_SCHEME_QUERY,
  DARK_THEME_CLASS,
  THEME_PREFERENCES_STORAGE_KEY,
  ThemePreferencesStore,
  parseStoredTheme,
  readSystemTheme,
} from './theme-preferences-store.service';

describe('parseStoredTheme', () => {
  it('returns null for values that are not an object', () => {
    expect(parseStoredTheme(null)).toBeNull();
    expect(parseStoredTheme('dark')).toBeNull();
  });

  it('returns null for an unknown theme', () => {
    expect(parseStoredTheme({ theme: 'sepia' })).toBeNull();
  });

  it('reads a stored theme', () => {
    expect(parseStoredTheme({ theme: 'dark' })).toBe('dark');
    expect(parseStoredTheme({ theme: 'light' })).toBe('light');
  });
});

describe('ThemePreferencesStore', () => {
  interface SystemThemeStub {
    emitChange: (prefersDark: boolean) => void;
  }

  /** Replaces `matchMedia`, which jsdom resolves to `matches: false` for every query. */
  function stubSystemTheme(prefersDark: boolean): SystemThemeStub {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const matchMedia = (query: string) => ({
      matches: query === DARK_COLOR_SCHEME_QUERY && prefersDark,
      media: query,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) =>
        listeners.delete(listener),
    });
    Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true });
    return {
      emitChange: (matches: boolean) =>
        listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent)),
    };
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_THEME_CLASS);
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_THEME_CLASS);
  });

  it('follows the system setting when nothing was stored', () => {
    stubSystemTheme(true);

    expect(TestBed.inject(ThemePreferencesStore).theme()).toBe('dark');
  });

  it('restores the theme chosen in a previous session over the system setting', () => {
    stubSystemTheme(true);
    localStorage.setItem(THEME_PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: 'light' }));

    expect(TestBed.inject(ThemePreferencesStore).theme()).toBe('light');
  });

  it('ignores a corrupted stored value', () => {
    stubSystemTheme(false);
    localStorage.setItem(THEME_PREFERENCES_STORAGE_KEY, '{not json');

    expect(TestBed.inject(ThemePreferencesStore).theme()).toBe('light');
  });

  it('persists the theme only after an explicit choice', () => {
    stubSystemTheme(true);
    const store = TestBed.inject(ThemePreferencesStore);

    TestBed.tick();
    expect(localStorage.getItem(THEME_PREFERENCES_STORAGE_KEY)).toBeNull();

    store.toggleTheme();
    TestBed.tick();

    expect(store.theme()).toBe('light');
    expect(JSON.parse(localStorage.getItem(THEME_PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({
      theme: 'light',
    });
  });

  it('toggles between both themes', () => {
    stubSystemTheme(false);
    const store = TestBed.inject(ThemePreferencesStore);

    store.toggleTheme();
    expect(store.isDarkTheme()).toBe(true);

    store.toggleTheme();
    expect(store.isDarkTheme()).toBe(false);
  });

  it('adds and removes the dark class on the document element', () => {
    stubSystemTheme(false);
    const store = TestBed.inject(ThemePreferencesStore);

    TestBed.tick();
    expect(document.documentElement.classList.contains(DARK_THEME_CLASS)).toBe(false);

    store.setTheme('dark');
    TestBed.tick();
    expect(document.documentElement.classList.contains(DARK_THEME_CLASS)).toBe(true);

    store.setTheme('light');
    TestBed.tick();
    expect(document.documentElement.classList.contains(DARK_THEME_CLASS)).toBe(false);
  });

  it('reacts to a system change while no theme was chosen', () => {
    const system = stubSystemTheme(false);
    const store = TestBed.inject(ThemePreferencesStore);

    system.emitChange(true);

    expect(store.theme()).toBe('dark');
  });

  it('stops following the system once the user chose a theme', () => {
    const system = stubSystemTheme(false);
    const store = TestBed.inject(ThemePreferencesStore);

    store.setTheme('light');
    system.emitChange(true);

    expect(store.theme()).toBe('light');
  });
});

describe('readSystemTheme', () => {
  it('falls back to light when matchMedia is unavailable', () => {
    const original = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      value: () => {
        throw new Error('unsupported');
      },
      configurable: true,
    });

    expect(readSystemTheme()).toBe('light');

    Object.defineProperty(window, 'matchMedia', { value: original, configurable: true });
  });
});
