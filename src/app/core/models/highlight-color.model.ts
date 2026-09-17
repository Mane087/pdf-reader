export type HighlightColor = 'yellow' | 'green' | 'blue' | 'red';

export const HIGHLIGHT_COLOR_ORDER: readonly HighlightColor[] = ['yellow', 'green', 'blue', 'red'];

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: '#FFFF98',
  green: '#53FFBC',
  blue: '#80EBFF',
  red: '#FF4F5F',
};

/** Format expected by PDFViewer's `annotationEditorHighlightColors` option. */
export const HIGHLIGHT_COLORS_CONFIG = HIGHLIGHT_COLOR_ORDER.map(
  (color) => `${color}=${HIGHLIGHT_COLORS[color]}`,
).join(',');

/** Display names used when an alias is left empty. */
export const HIGHLIGHT_COLOR_NAMES: Record<HighlightColor, string> = {
  yellow: 'Amarillo',
  green: 'Verde',
  blue: 'Azul',
  red: 'Rojo',
};

export type ColorAliases = Record<HighlightColor, string>;

export const DEFAULT_COLOR_ALIASES: ColorAliases = {
  yellow: 'Tema importante',
  green: 'Definición',
  blue: 'Ejemplo',
  red: 'Repasar tema',
};

export const MAX_COLOR_ALIAS_LENGTH = 40;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return typeof value === 'string' && (HIGHLIGHT_COLOR_ORDER as readonly string[]).includes(value);
}
