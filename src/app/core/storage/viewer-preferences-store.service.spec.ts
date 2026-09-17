import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_VIEWER_PREFERENCES,
  VIEWER_PREFERENCES_STORAGE_KEY,
  ViewerPreferencesStore,
  isValidScaleValue,
  parseStoredViewerPreferences,
} from './viewer-preferences-store.service';

describe('isValidScaleValue', () => {
  it.each(['auto', 'page-actual', 'page-fit', 'page-width'])(
    'accepts the preset "%s"',
    (preset) => {
      expect(isValidScaleValue(preset)).toBe(true);
    },
  );

  it('accepts a numeric value within 10% and 1000%', () => {
    expect(isValidScaleValue('1')).toBe(true);
    expect(isValidScaleValue('0.1')).toBe(true);
    expect(isValidScaleValue('10')).toBe(true);
  });

  it('rejects a numeric value below 10%', () => {
    expect(isValidScaleValue('0.05')).toBe(false);
  });

  it('rejects a numeric value above 1000%', () => {
    expect(isValidScaleValue('10.5')).toBe(false);
  });

  it('rejects a value that is not a preset nor a number', () => {
    expect(isValidScaleValue('garbage')).toBe(false);
  });
});

describe('parseStoredViewerPreferences', () => {
  it('returns the defaults when the value is null', () => {
    expect(parseStoredViewerPreferences(null)).toEqual(DEFAULT_VIEWER_PREFERENCES);
  });

  it('returns the defaults when the value is not an object', () => {
    expect(parseStoredViewerPreferences('not-an-object')).toEqual(DEFAULT_VIEWER_PREFERENCES);
  });

  it('reads a valid spreadMode', () => {
    const result = parseStoredViewerPreferences({ spreadMode: 'double' });

    expect(result.spreadMode).toBe('double');
  });

  it('ignores an invalid spreadMode and keeps the default', () => {
    const result = parseStoredViewerPreferences({ spreadMode: 'triple' });

    expect(result.spreadMode).toBe(DEFAULT_VIEWER_PREFERENCES.spreadMode);
  });

  it('reads a valid scaleValue', () => {
    const result = parseStoredViewerPreferences({ scaleValue: 'page-fit' });

    expect(result.scaleValue).toBe('page-fit');
  });

  it('ignores an invalid scaleValue and keeps the default', () => {
    const result = parseStoredViewerPreferences({ scaleValue: 'garbage' });

    expect(result.scaleValue).toBe(DEFAULT_VIEWER_PREFERENCES.scaleValue);
  });
});

describe('ViewerPreferencesStore', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('loads the default preferences when nothing is stored', () => {
    localStorage.clear();

    const store = TestBed.inject(ViewerPreferencesStore);

    expect(store.preferences()).toEqual(DEFAULT_VIEWER_PREFERENCES);
  });

  it('loads preferences previously stored in localStorage', () => {
    localStorage.setItem(
      VIEWER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ spreadMode: 'double', scaleValue: 'page-fit' }),
    );

    const store = TestBed.inject(ViewerPreferencesStore);

    expect(store.preferences()).toEqual({ spreadMode: 'double', scaleValue: 'page-fit' });
  });

  it('persists setSpreadMode to localStorage', () => {
    localStorage.clear();
    const store = TestBed.inject(ViewerPreferencesStore);

    store.setSpreadMode('double');
    TestBed.tick();

    const stored = JSON.parse(localStorage.getItem(VIEWER_PREFERENCES_STORAGE_KEY)!);
    expect(stored.spreadMode).toBe('double');
    expect(store.preferences().spreadMode).toBe('double');
  });

  it('persists setScaleValue to localStorage when the value is valid', () => {
    localStorage.clear();
    const store = TestBed.inject(ViewerPreferencesStore);

    store.setScaleValue('page-actual');
    TestBed.tick();

    const stored = JSON.parse(localStorage.getItem(VIEWER_PREFERENCES_STORAGE_KEY)!);
    expect(stored.scaleValue).toBe('page-actual');
    expect(store.preferences().scaleValue).toBe('page-actual');
  });

  it('ignores setScaleValue with an invalid value', () => {
    localStorage.clear();
    const store = TestBed.inject(ViewerPreferencesStore);

    store.setScaleValue('garbage');
    TestBed.tick();

    expect(store.preferences().scaleValue).toBe(DEFAULT_VIEWER_PREFERENCES.scaleValue);
  });
});
