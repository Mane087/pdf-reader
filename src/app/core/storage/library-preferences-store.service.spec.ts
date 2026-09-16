import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_LIBRARY_VIEW_MODE,
  LIBRARY_PREFERENCES_STORAGE_KEY,
  LibraryPreferencesStore,
  parseStoredLibraryViewMode,
} from './library-preferences-store.service';

describe('parseStoredLibraryViewMode', () => {
  it('falls back to the default for values that are not an object', () => {
    expect(parseStoredLibraryViewMode(null)).toBe(DEFAULT_LIBRARY_VIEW_MODE);
    expect(parseStoredLibraryViewMode('preview')).toBe(DEFAULT_LIBRARY_VIEW_MODE);
  });

  it('falls back to the default for an unknown view mode', () => {
    expect(parseStoredLibraryViewMode({ viewMode: 'mosaic' })).toBe(DEFAULT_LIBRARY_VIEW_MODE);
  });

  it('reads a stored view mode', () => {
    expect(parseStoredLibraryViewMode({ viewMode: 'preview' })).toBe('preview');
    expect(parseStoredLibraryViewMode({ viewMode: 'list' })).toBe('list');
  });
});

describe('LibraryPreferencesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => localStorage.clear());

  it('starts on the list view when nothing was stored', () => {
    expect(TestBed.inject(LibraryPreferencesStore).viewMode()).toBe('list');
  });

  it('restores the view mode stored by a previous session', () => {
    localStorage.setItem(LIBRARY_PREFERENCES_STORAGE_KEY, JSON.stringify({ viewMode: 'preview' }));

    expect(TestBed.inject(LibraryPreferencesStore).viewMode()).toBe('preview');
  });

  it('persists the selected view mode', () => {
    const store = TestBed.inject(LibraryPreferencesStore);

    store.setViewMode('preview');
    TestBed.tick();

    expect(store.viewMode()).toBe('preview');
    expect(JSON.parse(localStorage.getItem(LIBRARY_PREFERENCES_STORAGE_KEY) ?? '{}')).toEqual({
      viewMode: 'preview',
    });
  });

  it('ignores a corrupted stored value', () => {
    localStorage.setItem(LIBRARY_PREFERENCES_STORAGE_KEY, '{not json');

    expect(TestBed.inject(LibraryPreferencesStore).viewMode()).toBe('list');
  });
});
