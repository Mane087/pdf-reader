export type SpreadModeSetting = 'single' | 'double';

export const DEFAULT_SCALE_VALUE = 'page-width';

/** Minimum viewport width (px) required to enable the two-page mode. */
export const MIN_VIEWPORT_WIDTH_FOR_DOUBLE_PAGE = 900;

export interface ViewerPreferences {
  spreadMode: SpreadModeSetting;
  scaleValue: string;
}

export interface InitialViewState {
  scaleValue: string;
  spreadMode: SpreadModeSetting;
  page: number;
}
