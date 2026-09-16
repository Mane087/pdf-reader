import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AnnotationEditorType, AnnotationEditorUIManager, PDFDocumentProxy } from 'pdfjs-dist';
import {
  EventBus,
  LinkTarget,
  PDFLinkService,
  PDFViewer,
  ScrollMode,
  SpreadMode,
} from 'pdfjs-dist/web/pdf_viewer.mjs';

import { HIGHLIGHT_COLORS_CONFIG } from '../../core/models/highlight-color.model';
import { InitialViewState, SpreadModeSetting } from '../../core/models/reader-state.model';

interface PageChangingEvent {
  pageNumber: number;
}

interface PagesLoadedEvent {
  pagesCount: number;
}

interface ScaleChangingEvent {
  scale: number;
  presetValue?: string;
}

interface ModeEvent {
  mode: number;
}

interface UiManagerEvent {
  uiManager: AnnotationEditorUIManager;
}

interface EditingStatesEvent {
  details: { hasSelectedEditor?: boolean; hasSelectedText?: boolean };
}

interface SwitchEditorModeEvent {
  mode: number;
  editId?: string | null;
  mustEnterInEditMode?: boolean;
}

type PDFViewerConstructorOptions = ConstructorParameters<typeof PDFViewer>[0];

const EDITOR_MODE_SWITCH_TIMEOUT_MS = 3000;

export interface EditorModeOptions {
  editId?: string | null;
  mustEnterInEditMode?: boolean;
}

/**
 * Wraps `PDFViewer` from pdfjs-dist: EventBus events become signals and the
 * application issues commands through methods. Provided per reader screen so
 * the state resets with the document.
 *
 * Besides the plain bridge it implements the two pieces of glue that the
 * PDF.js viewer expects from the embedding application:
 *  - `showannotationeditorui` (requested by `highlightSelection()` when the
 *    editor is in NONE mode) → switch the viewer to that mode;
 *  - `switchannotationeditormode` (double click on an existing highlight in
 *    NONE mode) → enter HIGHLIGHT mode with that editor selected.
 *
 * The viewer is kept in NONE mode while reading, because in HIGHLIGHT mode
 * PDF.js turns every text selection into a highlight immediately.
 */
@Injectable()
export class PdfViewerAdapter {
  private readonly destroyRef = inject(DestroyRef);
  private readonly abortController = new AbortController();

  private eventBus: EventBus | null = null;
  private viewer: PDFViewer | null = null;
  private linkService: PDFLinkService | null = null;
  private pendingDocument: { pdfDocument: PDFDocumentProxy; initialView: InitialViewState } | null =
    null;
  private initialView: InitialViewState | null = null;
  private isSwitchingMode = false;

  private readonly currentPageState = signal(1);
  private readonly pageCountState = signal(0);
  private readonly scaleState = signal(1);
  private readonly scaleValueState = signal('page-width');
  private readonly spreadModeState = signal<SpreadModeSetting>('single');
  private readonly editorModeState = signal<number>(AnnotationEditorType.NONE);
  private readonly uiManagerState = signal<AnnotationEditorUIManager | null>(null);
  private readonly hasSelectedEditorState = signal(false);
  private readonly isReadyState = signal(false);

  readonly currentPage = this.currentPageState.asReadonly();
  readonly pageCount = this.pageCountState.asReadonly();
  readonly scale = this.scaleState.asReadonly();
  readonly scaleValue = this.scaleValueState.asReadonly();
  readonly spreadMode = this.spreadModeState.asReadonly();
  readonly uiManager = this.uiManagerState.asReadonly();
  readonly hasSelectedEditor = this.hasSelectedEditorState.asReadonly();
  /** `true` after `pagesinit`, when the viewer accepts page, scale and spread commands. */
  readonly isReady = this.isReadyState.asReadonly();

  constructor() {
    this.destroyRef.onDestroy(() => this.destroy());
  }

  /** Called once the container is in the DOM (`afterNextRender`). The container must be absolutely positioned. */
  attach(container: HTMLDivElement, viewerElement: HTMLDivElement): void {
    if (this.viewer) {
      return;
    }
    const eventBus = new EventBus();
    const linkService = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK });
    const options: PDFViewerConstructorOptions & { enableHighlightFloatingButton: boolean } = {
      container,
      viewer: viewerElement,
      eventBus,
      linkService,
      annotationEditorMode: AnnotationEditorType.NONE,
      annotationEditorHighlightColors: HIGHLIGHT_COLORS_CONFIG,
      // Not part of the published typedef, but read by the PDFViewer constructor.
      enableHighlightFloatingButton: false,
    };
    const viewer = new PDFViewer(options);
    linkService.setViewer(viewer);

    this.eventBus = eventBus;
    this.viewer = viewer;
    this.linkService = linkService;
    this.subscribeToEvents(eventBus);

    if (this.pendingDocument) {
      const { pdfDocument, initialView } = this.pendingDocument;
      this.pendingDocument = null;
      this.setDocument(pdfDocument, initialView);
    }
  }

  /** Loads the document; `initialView` is applied on `pagesinit`. Queued when the viewer is not attached yet. */
  setDocument(pdfDocument: PDFDocumentProxy, initialView: InitialViewState): void {
    if (!this.viewer || !this.linkService) {
      this.pendingDocument = { pdfDocument, initialView };
      return;
    }
    this.initialView = initialView;
    this.isReadyState.set(false);
    this.viewer.setDocument(pdfDocument);
    this.linkService.setDocument(pdfDocument, null);
  }

  clearDocument(): void {
    this.pendingDocument = null;
    this.initialView = null;
    this.isReadyState.set(false);
    this.uiManagerState.set(null);
    this.hasSelectedEditorState.set(false);
    this.editorModeState.set(AnnotationEditorType.NONE);
    if (this.viewer && this.linkService) {
      this.viewer.setDocument(null as unknown as PDFDocumentProxy);
      this.linkService.setDocument(null, null);
    }
  }

  nextPage(): void {
    this.viewer?.nextPage();
  }

  previousPage(): void {
    this.viewer?.previousPage();
  }

  goToPage(pageNumber: number): void {
    if (!this.viewer || !this.isReadyState()) {
      return;
    }
    const clamped = Math.min(Math.max(1, pageNumber), this.viewer.pagesCount);
    this.viewer.currentPageNumber = clamped;
  }

  goToFirstPage(): void {
    this.goToPage(1);
  }

  goToLastPage(): void {
    this.goToPage(this.pageCountState());
  }

  setSpreadMode(mode: SpreadModeSetting): void {
    if (this.viewer && this.isReadyState()) {
      this.viewer.spreadMode = toPdfjsSpreadMode(mode);
    }
  }

  setScaleValue(value: string): void {
    if (this.viewer && this.isReadyState()) {
      this.viewer.currentScaleValue = value;
    }
  }

  increaseScale(): void {
    this.viewer?.increaseScale();
  }

  decreaseScale(): void {
    this.viewer?.decreaseScale();
  }

  /** With a relative preset (page-width, page-fit, auto) the viewport must be recomputed after a resize. */
  refreshRelativeScale(): void {
    const value = this.scaleValueState();
    if (this.viewer && this.isReadyState() && Number.isNaN(Number(value))) {
      this.viewer.currentScaleValue = value;
    }
  }

  /** Resolves when the viewer reports the mode change. */
  setEditorMode(mode: number, options: EditorModeOptions = {}): Promise<void> {
    const { viewer, eventBus } = this;
    if (!viewer || !eventBus || !this.uiManagerState()) {
      return Promise.resolve();
    }
    // The PDFViewer setter returns early (without an event) when the mode is unchanged.
    if (this.editorModeState() === mode) {
      return Promise.resolve();
    }
    this.isSwitchingMode = true;
    return new Promise<void>((resolve) => {
      let timeoutId = 0;
      const finish = () => {
        clearTimeout(timeoutId);
        eventBus.off('annotationeditormodechanged', listener);
        this.isSwitchingMode = false;
        resolve();
      };
      const listener = (event: ModeEvent) => {
        if (event.mode === mode) {
          finish();
        }
      };
      eventBus.on('annotationeditormodechanged', listener, { signal: this.abortController.signal });
      // Safety net: the setter can also return early when no document is loaded.
      timeoutId = window.setTimeout(finish, EDITOR_MODE_SWITCH_TIMEOUT_MS);
      try {
        viewer.annotationEditorMode = {
          mode,
          editId: options.editId ?? null,
          mustEnterInEditMode: options.mustEnterInEditMode ?? false,
        };
      } catch (error) {
        console.error('PDF.js rejected the editor mode change', error);
        finish();
      }
    });
  }

  private subscribeToEvents(eventBus: EventBus): void {
    const options = { signal: this.abortController.signal };

    eventBus.on('pagesinit', () => this.applyInitialView(), options);
    eventBus.on(
      'pagesloaded',
      (event: PagesLoadedEvent) => this.pageCountState.set(event.pagesCount),
      options,
    );
    eventBus.on(
      'pagechanging',
      (event: PageChangingEvent) => this.currentPageState.set(event.pageNumber),
      options,
    );
    eventBus.on(
      'scalechanging',
      (event: ScaleChangingEvent) => {
        this.scaleState.set(event.scale);
        this.scaleValueState.set(event.presetValue ?? String(event.scale));
      },
      options,
    );
    eventBus.on(
      'spreadmodechanged',
      (event: ModeEvent) =>
        this.spreadModeState.set(event.mode === SpreadMode.ODD ? 'double' : 'single'),
      options,
    );
    eventBus.on(
      'annotationeditoruimanager',
      (event: UiManagerEvent) => this.uiManagerState.set(event.uiManager),
      options,
    );
    eventBus.on(
      'annotationeditormodechanged',
      (event: ModeEvent) => this.editorModeState.set(event.mode),
      options,
    );
    eventBus.on(
      'editingstateschanged',
      (event: EditingStatesEvent) => this.onEditingStatesChanged(event),
      options,
    );

    // Glue expected from the embedding application (see class comment).
    eventBus.on(
      'showannotationeditorui',
      (event: ModeEvent) => void this.setEditorMode(event.mode),
      options,
    );
    eventBus.on(
      'switchannotationeditormode',
      (event: SwitchEditorModeEvent) =>
        void this.setEditorMode(event.mode, {
          editId: event.editId ?? null,
          mustEnterInEditMode: event.mustEnterInEditMode ?? false,
        }),
      options,
    );
  }

  private applyInitialView(): void {
    const viewer = this.viewer;
    if (!viewer) {
      return;
    }
    viewer.scrollMode = ScrollMode.VERTICAL;
    const initialView = this.initialView;
    if (initialView) {
      viewer.currentScaleValue = initialView.scaleValue;
      viewer.spreadMode = toPdfjsSpreadMode(initialView.spreadMode);
      viewer.currentPageNumber = Math.min(Math.max(1, initialView.page), viewer.pagesCount || 1);
    }
    this.isReadyState.set(true);
  }

  private onEditingStatesChanged(event: EditingStatesEvent): void {
    const hasSelectedEditor = event.details.hasSelectedEditor;
    if (hasSelectedEditor === undefined) {
      return;
    }
    this.hasSelectedEditorState.set(hasSelectedEditor);
    if (hasSelectedEditor) {
      return;
    }
    // Leave HIGHLIGHT mode when nothing is selected any more. Deferred with a
    // microtask because PDF.js dispatches this event from inside its own
    // pointer handlers, and re-entering `updateMode` there is unsafe.
    queueMicrotask(() => {
      if (!this.isSwitchingMode && this.editorModeState() === AnnotationEditorType.HIGHLIGHT) {
        void this.setEditorMode(AnnotationEditorType.NONE);
      }
    });
  }

  private destroy(): void {
    this.abortController.abort();
    if (this.viewer) {
      this.viewer.setDocument(null as unknown as PDFDocumentProxy);
      this.viewer.cleanup();
    }
    this.linkService?.setDocument(null, null);
    this.viewer = null;
    this.linkService = null;
    this.eventBus = null;
  }
}

function toPdfjsSpreadMode(mode: SpreadModeSetting): number {
  return mode === 'double' ? SpreadMode.ODD : SpreadMode.NONE;
}
