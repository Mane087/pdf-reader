import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  output,
  viewChild,
} from '@angular/core';

import {
  HIGHLIGHT_COLORS,
  HIGHLIGHT_COLOR_NAMES,
  HIGHLIGHT_COLOR_ORDER,
  HighlightColor,
  MAX_COLOR_ALIAS_LENGTH,
} from '../../core/models/highlight-color.model';
import { ColorAliasStore } from '../../core/storage/color-alias-store.service';

/**
 * Panel to edit the meaning of each highlight color. Aliases are global, not
 * per document. Uses the native modal dialog, so Escape closes it and the
 * focus stays inside while it is open.
 */
@Component({
  selector: 'app-color-alias-settings',
  template: `
    <dialog
      #dialog
      class="m-auto w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900"
      (close)="closed.emit()"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Alias de colores</h2>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
        El alias describe el significado de cada color. Máximo {{ maxLength }} caracteres.
      </p>

      <div class="mt-4 space-y-3">
        @for (color of colors; track color) {
          <label class="flex items-center gap-3">
            <span
              class="h-6 w-6 shrink-0 rounded-md border border-black/10 dark:border-white/20"
              [style.background-color]="swatches[color]"
              aria-hidden="true"
            ></span>
            <span class="w-20 shrink-0 text-sm text-slate-700 dark:text-slate-300">{{
              colorNames[color]
            }}</span>
            <input
              type="text"
              class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
              [value]="store.aliases()[color]"
              [attr.maxlength]="maxLength"
              (change)="onAliasChange(color, $event)"
            />
          </label>
        }
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          (click)="store.resetToDefaults()"
        >
          Restablecer
        </button>
        <button
          type="button"
          class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          (click)="close()"
        >
          Cerrar
        </button>
      </div>
    </dialog>
  `,
  styles: `
    dialog::backdrop {
      background-color: rgb(15 23 42 / 0.4);
    }

    :host-context(html.dark) dialog::backdrop {
      background-color: rgb(2 6 23 / 0.6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorAliasSettingsComponent {
  protected readonly store = inject(ColorAliasStore);
  readonly closed = output();

  readonly colors = HIGHLIGHT_COLOR_ORDER;
  readonly swatches = HIGHLIGHT_COLORS;
  readonly colorNames = HIGHLIGHT_COLOR_NAMES;
  readonly maxLength = MAX_COLOR_ALIAS_LENGTH;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected close(): void {
    // `close` emits the native event, which re-emits `closed` through the template binding.
    this.dialog().nativeElement.close();
  }

  protected onAliasChange(color: HighlightColor, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setAlias(color, input.value);
    input.value = this.store.aliases()[color];
  }
}
