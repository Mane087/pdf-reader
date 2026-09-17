import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { documentEventSignal, windowEventSignal } from '../../core/browser-events/dom-event-signal';
import { FullscreenService } from '../../core/browser-events/fullscreen.service';
import { HighlightColor } from '../../core/models/highlight-color.model';
import {
  MIN_VIEWPORT_WIDTH_FOR_DOUBLE_PAGE,
  SpreadModeSetting,
} from '../../core/models/reader-state.model';
import { ColorAliasStore } from '../../core/storage/color-alias-store.service';
import { ThemePreferencesStore } from '../../core/storage/theme-preferences-store.service';
import { ColorAliasSettingsComponent } from './color-alias-settings.component';
import { HighlightAdapter } from './highlight-adapter.service';
import { HighlightToolbarComponent, HighlightToolbarMode } from './highlight-toolbar.component';
import { resolvePageNavigation } from './keyboard-navigation';
import { PdfViewerAdapter } from './pdf-viewer-adapter.service';
import { PdfViewerHostComponent } from './pdf-viewer-host.component';
import { ReaderStore } from './reader-store.service';
import { ReaderToolbarComponent } from './reader-toolbar.component';
import { SelectionAnchor, getTextLayerSelectionAnchor } from './text-selection';
import { UnsavedChangesAware } from './unsaved-changes.guard';

@Component({
  selector: 'app-reader',
  imports: [
    RouterLink,
    ReaderToolbarComponent,
    PdfViewerHostComponent,
    HighlightToolbarComponent,
    ColorAliasSettingsComponent,
  ],
  providers: [PdfViewerAdapter, HighlightAdapter, ReaderStore],
  template: `
    <div class="flex h-full flex-col bg-slate-100 dark:bg-slate-950">
      <app-reader-toolbar
        [fileName]="store.fileName()"
        [currentPage]="store.currentPage()"
        [pageCount]="store.pageCount()"
        [scalePercent]="store.scalePercent()"
        [spreadMode]="store.spreadMode()"
        [canUseDoublePage]="canUseDoublePage()"
        [isReady]="store.isViewerReady()"
        [canSave]="store.canSave()"
        [isSaving]="store.isSaving()"
        [hasUnsavedChanges]="store.hasUnsavedChanges()"
        [canWriteInPlace]="store.canWriteInPlace()"
        [isDarkTheme]="theme.isDarkTheme()"
        [isFullscreen]="fullscreen.isFullscreen()"
        [canUseFullscreen]="fullscreen.canUseFullscreen"
        (zoomIn)="store.zoomIn()"
        (zoomOut)="store.zoomOut()"
        (spreadModeChange)="onSpreadModeChange($event)"
        (save)="store.save()"
        (saveCopy)="store.saveCopy()"
        (openAliasSettings)="isAliasPanelOpen.set(true)"
        (themeToggled)="theme.toggleTheme()"
        (fullscreenToggled)="onFullscreenToggled()"
      />

      @if (store.error(); as error) {
        <div
          class="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          <span class="flex-1">{{ error }}</span>
          <a routerLink="/" class="font-medium underline">Volver a la biblioteca</a>
          <button
            type="button"
            class="rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900"
            (click)="store.dismissMessages()"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      } @else if (store.notice(); as notice) {
        <div
          class="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          role="status"
        >
          <span class="flex-1">{{ notice }}</span>
          <button
            type="button"
            class="rounded px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-900"
            (click)="store.dismissMessages()"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      }

      <main class="relative min-h-0 flex-1">
        <app-pdf-viewer-host />
        @if (store.isLoading()) {
          <div
            class="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 text-sm text-slate-700 dark:bg-slate-950/80 dark:text-slate-300"
            role="status"
          >
            Cargando documento…
          </div>
        }
      </main>

      @if (highlightToolbarMode(); as mode) {
        <app-highlight-toolbar
          [mode]="mode"
          [aliases]="aliases.aliases()"
          [anchor]="mode === 'create' ? selectionAnchor() : null"
          (colorSelected)="onColorSelected(mode, $event)"
          (deleteRequested)="highlights.deleteSelected()"
        />
      }

      <!--
        The alias panel is opened on demand, so its code is kept in its own
        chunk. The conditional controls the visibility, because a deferred
        block never returns to its placeholder once it has been rendered.
      -->
      @if (isAliasPanelOpen()) {
        @defer (on immediate) {
          <app-color-alias-settings (closed)="isAliasPanelOpen.set(false)" />
        } @placeholder {
          <div
            class="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60"
          >
            <p
              class="rounded-lg bg-white px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"
              role="status"
            >
              Cargando alias de colores…
            </p>
          </div>
        } @error {
          <div
            class="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60"
          >
            <div
              class="flex flex-col gap-3 rounded-lg bg-white px-4 py-3 text-sm text-red-800 dark:bg-slate-900 dark:text-red-200"
            >
              <p role="alert">No fue posible cargar el panel de alias. Recarga la página.</p>
              <button
                type="button"
                class="self-end rounded-md bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                (click)="isAliasPanelOpen.set(false)"
              >
                Cerrar
              </button>
            </div>
          </div>
        }
      }
    </div>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderComponent implements OnInit, UnsavedChangesAware {
  readonly documentId = input.required<string>();

  protected readonly store = inject(ReaderStore);
  protected readonly highlights = inject(HighlightAdapter);
  protected readonly aliases = inject(ColorAliasStore);
  protected readonly theme = inject(ThemePreferencesStore);
  protected readonly fullscreen = inject(FullscreenService);
  private readonly viewer = inject(PdfViewerAdapter);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isAliasPanelOpen = signal(false);
  protected readonly selectionAnchor = signal<SelectionAnchor | null>(null);
  private readonly viewportWidth = signal(window.innerWidth);

  protected readonly canUseDoublePage = computed(
    () => this.viewportWidth() >= MIN_VIEWPORT_WIDTH_FOR_DOUBLE_PAGE,
  );
  protected readonly highlightToolbarMode = computed<HighlightToolbarMode | null>(() => {
    if (this.highlights.hasSelectedEditor()) {
      return 'edit';
    }
    if (this.selectionAnchor() && this.store.hasSelectableText() && !this.isAliasPanelOpen()) {
      return 'create';
    }
    return null;
  });

  // Browser events as signals (section 12 of the spec).
  private readonly keydown = windowEventSignal('keydown');
  private readonly resize = windowEventSignal('resize');
  private readonly selectionChange = documentEventSignal('selectionchange');
  private readonly scroll = documentEventSignal('scroll', { capture: true, passive: true });

  constructor() {
    effect(() => {
      const event = this.keydown();
      if (event) {
        untracked(() => this.handleKeydown(event));
      }
    });

    effect(() => {
      this.resize();
      untracked(() => {
        this.viewportWidth.set(window.innerWidth);
        this.viewer.refreshRelativeScale();
      });
    });

    effect(() => {
      this.selectionChange();
      this.scroll();
      untracked(() => this.updateSelectionAnchor());
    });

    // Narrow screens cannot show two pages side by side.
    effect(() => {
      if (!this.canUseDoublePage() && this.store.spreadMode() === 'double') {
        untracked(() => this.viewer.setSpreadMode('single'));
      }
    });

    // `beforeunload` must call `preventDefault()` synchronously, so it cannot go through a signal.
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.store.hasUnsavedChanges()) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    this.destroyRef.onDestroy(() => window.removeEventListener('beforeunload', warnBeforeUnload));
  }

  ngOnInit(): void {
    void this.store.open(this.documentId());
  }

  hasUnsavedChanges(): boolean {
    return this.store.hasUnsavedChanges();
  }

  protected onFullscreenToggled(): void {
    void this.fullscreen.toggle();
  }

  protected onSpreadModeChange(mode: SpreadModeSetting): void {
    if (mode === 'double' && !this.canUseDoublePage()) {
      return;
    }
    this.store.setSpreadMode(mode);
  }

  protected async onColorSelected(
    mode: HighlightToolbarMode,
    color: HighlightColor,
  ): Promise<void> {
    if (mode === 'edit') {
      this.highlights.changeSelectedColor(color);
      return;
    }
    await this.highlights.createHighlightFromSelection(color);
    this.selectionAnchor.set(null);
  }

  private handleKeydown(event: KeyboardEvent): void {
    const command = resolvePageNavigation(event, {
      hasSelectedEditor: this.highlights.hasSelectedEditor(),
      isDialogOpen: this.isAliasPanelOpen(),
    });
    if (!command) {
      return;
    }
    // Effects run after the event was dispatched, so the browser default
    // (scrolling on Home/End) cannot be prevented here; with vertical scroll
    // it lands on the same page anyway.
    switch (command) {
      case 'next':
        this.viewer.nextPage();
        break;
      case 'previous':
        this.viewer.previousPage();
        break;
      case 'first':
        this.viewer.goToFirstPage();
        break;
      case 'last':
        this.viewer.goToLastPage();
        break;
    }
  }

  private updateSelectionAnchor(): void {
    this.selectionAnchor.set(
      getTextLayerSelectionAnchor(document.getSelection(), this.host.nativeElement),
    );
  }
}
