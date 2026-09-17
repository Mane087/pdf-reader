import { Injectable, inject } from '@angular/core';
import { AnnotationEditorParamsType, AnnotationEditorType } from 'pdfjs-dist';

import { HIGHLIGHT_COLORS, HighlightColor } from '../../core/models/highlight-color.model';
import { PdfViewerAdapter } from './pdf-viewer-adapter.service';

/**
 * Bridge with `AnnotationEditorUIManager`. PDF.js computes the boxes from the
 * browser selection (with rotation), draws the highlight, keeps it in
 * `AnnotationStorage` and serializes it as a standard /Highlight annotation.
 */
@Injectable()
export class HighlightAdapter {
  private readonly viewer = inject(PdfViewerAdapter);

  /** `true` while a highlight (new or existing) is selected in the viewer. */
  readonly hasSelectedEditor = this.viewer.hasSelectedEditor;

  /**
   * Creates a highlight from the current browser selection.
   * The color is set as the editor default before the highlight exists and
   * applied again to the new editor once it is selected, so it works whether
   * or not PDF.js selects the editor it just created.
   */
  async createHighlightFromSelection(color: HighlightColor): Promise<boolean> {
    const uiManager = this.viewer.uiManager();
    const selection = document.getSelection();
    if (!uiManager || !selection || selection.isCollapsed) {
      return false;
    }
    const hex = HIGHLIGHT_COLORS[color];
    uiManager.unselectAll();
    uiManager.updateParams(AnnotationEditorParamsType.HIGHLIGHT_COLOR, hex);
    await this.viewer.setEditorMode(AnnotationEditorType.HIGHLIGHT);
    uiManager.highlightSelection('main_toolbar');
    if (uiManager.hasSelection) {
      uiManager.updateParams(AnnotationEditorParamsType.HIGHLIGHT_COLOR, hex);
    }
    return true;
  }

  /** Changes the color of the selected highlight (new or already present in the file). */
  changeSelectedColor(color: HighlightColor): void {
    const uiManager = this.viewer.uiManager();
    if (uiManager?.hasSelection) {
      uiManager.updateParams(AnnotationEditorParamsType.HIGHLIGHT_COLOR, HIGHLIGHT_COLORS[color]);
    }
  }

  deleteSelected(): void {
    const uiManager = this.viewer.uiManager();
    if (uiManager?.hasSelection) {
      uiManager.delete();
    }
  }
}
