import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  ColorAliases,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_ORDER,
  HighlightColor,
} from '../../core/models/highlight-color.model';
import { SelectionAnchor } from './text-selection';

export type HighlightToolbarMode = 'create' | 'edit';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const TOOLBAR_OFFSET_PX = 8;
const TOOLBAR_ESTIMATED_WIDTH_PX = 420;
const TOOLBAR_ESTIMATED_HEIGHT_PX = 44;

/**
 * Floating color toolbar. In `create` mode it sits above the text selection;
 * in `edit` mode (a highlight is selected) it recolors or deletes it.
 */
@Component({
  selector: 'app-highlight-toolbar',
  template: `
    <div
      #toolbar
      class="fixed z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      [style.left.px]="position().left"
      [style.top.px]="position().top"
      role="toolbar"
      [attr.aria-label]="mode() === 'create' ? 'Resaltar selección' : 'Editar resaltado'"
    >
      @for (color of colors; track color) {
        <button
          type="button"
          class="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          (mousedown)="$event.preventDefault()"
          (click)="colorSelected.emit(color)"
          [title]="aliases()[color]"
        >
          <span
            class="h-4 w-4 rounded-sm border border-black/10 dark:border-white/20"
            [style.background-color]="swatches[color]"
            aria-hidden="true"
          ></span>
          <span class="max-w-40 truncate">{{ aliases()[color] }}</span>
        </button>
      }
      @if (mode() === 'edit') {
        <span class="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true"></span>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
          (mousedown)="$event.preventDefault()"
          (click)="deleteRequested.emit()"
        >
          Eliminar
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightToolbarComponent {
  readonly mode = input.required<HighlightToolbarMode>();
  readonly aliases = input.required<ColorAliases>();
  /** Selection box in viewport coordinates; `null` centers the toolbar at the top of the viewport. */
  readonly anchor = input<SelectionAnchor | null>(null);

  readonly colorSelected = output<HighlightColor>();
  readonly deleteRequested = output();

  readonly colors = HIGHLIGHT_COLOR_ORDER;
  readonly swatches = HIGHLIGHT_COLORS;

  private readonly toolbar = viewChild.required<ElementRef<HTMLDivElement>>('toolbar');
  private readonly width = signal(TOOLBAR_ESTIMATED_WIDTH_PX);
  private readonly height = signal(TOOLBAR_ESTIMATED_HEIGHT_PX);

  constructor() {
    // The real size depends on the alias lengths and on whether "Eliminar" is
    // shown, so it is measured after rendering and used to keep the toolbar
    // inside the viewport.
    afterRenderEffect(() => {
      const element = this.toolbar().nativeElement;
      this.width.set(element.offsetWidth);
      this.height.set(element.offsetHeight);
    });
  }

  /** Placed above the selection when it fits, below otherwise, always inside the viewport. */
  readonly position = computed(() => {
    const width = this.width();
    const height = this.height();
    const maxLeft = Math.max(TOOLBAR_OFFSET_PX, window.innerWidth - width - TOOLBAR_OFFSET_PX);
    const maxTop = Math.max(TOOLBAR_OFFSET_PX, window.innerHeight - height - TOOLBAR_OFFSET_PX);
    const anchor = this.anchor();
    if (!anchor) {
      return {
        left: clamp((window.innerWidth - width) / 2, TOOLBAR_OFFSET_PX, maxLeft),
        top: TOOLBAR_OFFSET_PX,
      };
    }
    const above = anchor.top - height - TOOLBAR_OFFSET_PX;
    const preferredTop =
      above > TOOLBAR_OFFSET_PX ? above : anchor.top + anchor.height + TOOLBAR_OFFSET_PX;
    return {
      left: clamp(anchor.left, TOOLBAR_OFFSET_PX, maxLeft),
      top: clamp(preferredTop, TOOLBAR_OFFSET_PX, maxTop),
    };
  });
}
