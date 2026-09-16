import { Injectable, effect, signal } from '@angular/core';

import {
  DEFAULT_SCALE_VALUE,
  SpreadModeSetting,
  ViewerPreferences,
} from '../models/reader-state.model';
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from './local-storage.util';

export const VIEWER_PREFERENCES_STORAGE_KEY = 'pdf-reader.viewer-preferences.v1';

export const DEFAULT_VIEWER_PREFERENCES: ViewerPreferences = {
  spreadMode: 'single',
  scaleValue: DEFAULT_SCALE_VALUE,
};

const SPREAD_MODES: readonly SpreadModeSetting[] = ['single', 'double'];
const SCALE_PRESETS = ['auto', 'page-actual', 'page-fit', 'page-width'];

export function parseStoredViewerPreferences(value: unknown): ViewerPreferences {
  const preferences: ViewerPreferences = { ...DEFAULT_VIEWER_PREFERENCES };
  if (typeof value !== 'object' || value === null) {
    return preferences;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record['spreadMode'] === 'string' &&
    (SPREAD_MODES as readonly string[]).includes(record['spreadMode'])
  ) {
    preferences.spreadMode = record['spreadMode'] as SpreadModeSetting;
  }
  if (typeof record['scaleValue'] === 'string' && isValidScaleValue(record['scaleValue'])) {
    preferences.scaleValue = record['scaleValue'];
  }
  return preferences;
}

/** Accepts PDF.js presets or a numeric scale between 10 % and 1000 %. */
export function isValidScaleValue(value: string): boolean {
  if (SCALE_PRESETS.includes(value)) {
    return true;
  }
  const scale = Number(value);
  return Number.isFinite(scale) && scale >= 0.1 && scale <= 10;
}

@Injectable({ providedIn: 'root' })
export class ViewerPreferencesStore {
  private readonly preferencesState = signal<ViewerPreferences>(
    parseStoredViewerPreferences(readJsonFromLocalStorage(VIEWER_PREFERENCES_STORAGE_KEY)),
  );

  readonly preferences = this.preferencesState.asReadonly();

  constructor() {
    effect(() => writeJsonToLocalStorage(VIEWER_PREFERENCES_STORAGE_KEY, this.preferencesState()));
  }

  setSpreadMode(spreadMode: SpreadModeSetting): void {
    this.preferencesState.update((current) => ({ ...current, spreadMode }));
  }

  setScaleValue(scaleValue: string): void {
    if (isValidScaleValue(scaleValue)) {
      this.preferencesState.update((current) => ({ ...current, scaleValue }));
    }
  }
}
