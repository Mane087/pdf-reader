import { TestBed } from '@angular/core/testing';

import { DEFAULT_COLOR_ALIASES, HIGHLIGHT_COLOR_NAMES } from '../models/highlight-color.model';
import {
  COLOR_ALIASES_STORAGE_KEY,
  ColorAliasStore,
  normalizeColorAlias,
  parseStoredColorAliases,
} from './color-alias-store.service';

describe('normalizeColorAlias', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeColorAlias('yellow', '  Important  ')).toBe('Important');
  });

  it('truncates the alias to 40 characters', () => {
    const longAlias = 'a'.repeat(50);

    expect(normalizeColorAlias('yellow', longAlias)).toBe('a'.repeat(40));
  });

  it('falls back to the Spanish color name when the alias is empty', () => {
    expect(normalizeColorAlias('yellow', '')).toBe(HIGHLIGHT_COLOR_NAMES['yellow']);
  });

  it('falls back to the Spanish color name when the alias is only whitespace', () => {
    expect(normalizeColorAlias('red', '   ')).toBe(HIGHLIGHT_COLOR_NAMES['red']);
  });
});

describe('parseStoredColorAliases', () => {
  it('returns the defaults when the value is null', () => {
    expect(parseStoredColorAliases(null)).toEqual(DEFAULT_COLOR_ALIASES);
  });

  it('returns the defaults when the value is not an object', () => {
    expect(parseStoredColorAliases('not-an-object')).toEqual(DEFAULT_COLOR_ALIASES);
  });

  it('fills the gaps with defaults when the stored object is partial', () => {
    const result = parseStoredColorAliases({ yellow: 'Custom yellow' });

    expect(result).toEqual({ ...DEFAULT_COLOR_ALIASES, yellow: 'Custom yellow' });
  });

  it('ignores non-string values for a color', () => {
    const result = parseStoredColorAliases({ yellow: 42 });

    expect(result).toEqual(DEFAULT_COLOR_ALIASES);
  });
});

describe('ColorAliasStore', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('loads the default aliases when nothing is stored', () => {
    localStorage.clear();

    const store = TestBed.inject(ColorAliasStore);

    expect(store.aliases()).toEqual(DEFAULT_COLOR_ALIASES);
  });

  it('loads aliases previously stored in localStorage', () => {
    localStorage.setItem(COLOR_ALIASES_STORAGE_KEY, JSON.stringify({ yellow: 'Stored yellow' }));

    const store = TestBed.inject(ColorAliasStore);

    expect(store.aliases()['yellow']).toBe('Stored yellow');
  });

  it('persists a new alias to localStorage after setAlias', () => {
    localStorage.clear();
    const store = TestBed.inject(ColorAliasStore);

    store.setAlias('green', 'My definitions');
    TestBed.tick();

    const stored = JSON.parse(localStorage.getItem(COLOR_ALIASES_STORAGE_KEY)!);
    expect(stored.green).toBe('My definitions');
  });

  it('resets to the default aliases', () => {
    localStorage.clear();
    const store = TestBed.inject(ColorAliasStore);

    store.setAlias('green', 'My definitions');
    store.resetToDefaults();
    TestBed.tick();

    expect(store.aliases()).toEqual(DEFAULT_COLOR_ALIASES);
  });

  it('reloads the aliases from localStorage when a matching storage event is dispatched', () => {
    localStorage.clear();
    const store = TestBed.inject(ColorAliasStore);
    TestBed.tick();

    localStorage.setItem(COLOR_ALIASES_STORAGE_KEY, JSON.stringify({ blue: 'External change' }));
    window.dispatchEvent(new StorageEvent('storage', { key: COLOR_ALIASES_STORAGE_KEY }));
    TestBed.tick();

    expect(store.aliases()['blue']).toBe('External change');
  });

  it('ignores storage events for a different key', () => {
    localStorage.clear();
    const store = TestBed.inject(ColorAliasStore);
    TestBed.tick();

    store.setAlias('green', 'My definitions');
    TestBed.tick();

    localStorage.setItem('some-other-key', 'value');
    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }));
    TestBed.tick();

    expect(store.aliases()['green']).toBe('My definitions');
  });
});
