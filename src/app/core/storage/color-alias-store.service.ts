import { Injectable, effect, signal } from '@angular/core';

import { windowEventSignal } from '../browser-events/dom-event-signal';
import {
  ColorAliases,
  DEFAULT_COLOR_ALIASES,
  HIGHLIGHT_COLOR_NAMES,
  HIGHLIGHT_COLOR_ORDER,
  HighlightColor,
  MAX_COLOR_ALIAS_LENGTH,
} from '../models/highlight-color.model';
import { readJsonFromLocalStorage, writeJsonToLocalStorage } from './local-storage.util';

export const COLOR_ALIASES_STORAGE_KEY = 'pdf-reader.color-aliases.v1';

/** Trims, truncates and falls back to the color name when the alias is empty. */
export function normalizeColorAlias(color: HighlightColor, alias: string): string {
  const trimmed = alias.trim().slice(0, MAX_COLOR_ALIAS_LENGTH);
  return trimmed.length > 0 ? trimmed : HIGHLIGHT_COLOR_NAMES[color];
}

/** Builds a complete alias map from an untrusted stored value, filling gaps with defaults. */
export function parseStoredColorAliases(value: unknown): ColorAliases {
  const aliases: ColorAliases = { ...DEFAULT_COLOR_ALIASES };
  if (typeof value !== 'object' || value === null) {
    return aliases;
  }
  const record = value as Record<string, unknown>;
  for (const color of HIGHLIGHT_COLOR_ORDER) {
    const stored = record[color];
    if (typeof stored === 'string') {
      aliases[color] = normalizeColorAlias(color, stored);
    }
  }
  return aliases;
}

/**
 * Aliases are global (not per document) and small, so they live in `localStorage`.
 * The `storage` event keeps several tabs in sync.
 */
@Injectable({ providedIn: 'root' })
export class ColorAliasStore {
  private readonly aliasesState = signal<ColorAliases>(loadStoredAliases());
  private readonly storageEvent = windowEventSignal('storage');

  readonly aliases = this.aliasesState.asReadonly();

  constructor() {
    // Sync towards a non-reactive API: the only accepted use of `effect` for writes.
    effect(() => writeJsonToLocalStorage(COLOR_ALIASES_STORAGE_KEY, this.aliasesState()));
    effect(() => {
      const event = this.storageEvent();
      if (event && (event.key === COLOR_ALIASES_STORAGE_KEY || event.key === null)) {
        this.aliasesState.set(loadStoredAliases());
      }
    });
  }

  setAlias(color: HighlightColor, alias: string): void {
    const normalized = normalizeColorAlias(color, alias);
    this.aliasesState.update((current) => ({ ...current, [color]: normalized }));
  }

  resetToDefaults(): void {
    this.aliasesState.set({ ...DEFAULT_COLOR_ALIASES });
  }
}

function loadStoredAliases(): ColorAliases {
  return parseStoredColorAliases(readJsonFromLocalStorage(COLOR_ALIASES_STORAGE_KEY));
}
