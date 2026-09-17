import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SpreadModeSetting } from '../../core/models/reader-state.model';

@Component({
  selector: 'app-reader-toolbar',
  imports: [RouterLink],
  template: `
    <header
      class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-slate-200 bg-white px-4 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <div class="flex min-w-0 items-center gap-2">
        <a
          routerLink="/"
          class="shrink-0 rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Volver a la biblioteca"
          title="Volver a la biblioteca"
        >
          <!-- The link already has an accessible name, so the icon is decorative. -->
          <img src="icons/back.svg" alt="" class="icon-neutral h-5 w-5" width="24" height="24" />
        </a>
        <h1
          class="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100"
          [title]="fileName()"
        >
          {{ fileName() }}
        </h1>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        <div class="flex items-center gap-1" role="group" aria-label="Zoom">
          <button
            type="button"
            [class]="buttonClass"
            (click)="zoomOut.emit()"
            [disabled]="!isReady()"
            aria-label="Reducir zoom"
          >
            −
          </button>
          <span class="w-12 text-center text-sm tabular-nums text-slate-700 dark:text-slate-300"
            >{{ scalePercent() }}%</span
          >
          <button
            type="button"
            [class]="buttonClass"
            (click)="zoomIn.emit()"
            [disabled]="!isReady()"
            aria-label="Aumentar zoom"
          >
            +
          </button>
        </div>

        <div class="flex items-center gap-1" role="group" aria-label="Páginas por vista">
          <button
            type="button"
            [class]="spreadMode() === 'single' ? activeButtonClass : buttonClass"
            [attr.aria-pressed]="spreadMode() === 'single'"
            [disabled]="!isReady()"
            (click)="spreadModeChange.emit('single')"
            aria-label="Una página"
            title="Una página"
          >
            1
          </button>
          <button
            type="button"
            [class]="spreadMode() === 'double' ? activeButtonClass : buttonClass"
            [attr.aria-pressed]="spreadMode() === 'double'"
            [disabled]="!isReady() || !canUseDoublePage()"
            (click)="spreadModeChange.emit('double')"
            aria-label="Dos páginas"
            title="Dos páginas"
          >
            2
          </button>
        </div>

        <span
          class="text-sm tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300"
          aria-live="polite"
          data-testid="page-indicator"
          >{{ pageLabel() }}</span
        >
      </div>

      <div class="flex items-center justify-end gap-2">
        @if (canUseFullscreen()) {
          <button
            type="button"
            [class]="iconButtonClass"
            (click)="fullscreenToggled.emit()"
            [attr.aria-pressed]="isFullscreen()"
            [attr.aria-label]="fullscreenLabel()"
            [title]="fullscreenLabel()"
            data-testid="fullscreen-toggle"
          >
            <!-- The button carries the accessible name, so the icon is decorative. -->
            <img
              [src]="isFullscreen() ? 'icons/fullscreen-exit.svg' : 'icons/fullscreen.svg'"
              alt=""
              class="icon-neutral h-5 w-5"
              width="24"
              height="24"
            />
          </button>
        }

        <button
          type="button"
          [class]="iconButtonClass"
          (click)="themeToggled.emit()"
          [attr.aria-pressed]="isDarkTheme()"
          [attr.aria-label]="themeLabel()"
          [title]="themeLabel()"
          data-testid="theme-toggle"
        >
          <!-- Shows the theme the button switches to, not the active one. -->
          <img
            [src]="isDarkTheme() ? 'icons/sun.svg' : 'icons/moon.svg'"
            alt=""
            class="h-5 w-5"
            width="24"
            height="24"
          />
        </button>

        <button
          type="button"
          [class]="buttonClass"
          (click)="openAliasSettings.emit()"
          title="Editar alias de colores"
        >
          Alias
        </button>

        <button
          type="button"
          class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-500 dark:hover:bg-blue-400 dark:disabled:bg-slate-700"
          [disabled]="!canSave()"
          (click)="save.emit()"
          [title]="
            canWriteInPlace()
              ? 'Guardar sobre el mismo archivo'
              : 'Actualizar la copia local y descargar el archivo'
          "
        >
          @if (isSaving()) {
            Guardando…
          } @else {
            Guardar
          }
        </button>

        @if (hasUnsavedChanges()) {
          <span
            class="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"
            role="status"
            aria-label="Cambios sin guardar"
            title="Cambios sin guardar"
          ></span>
        }

        <button
          type="button"
          [class]="buttonClass"
          [disabled]="!isReady() || isSaving()"
          (click)="saveCopy.emit()"
        >
          Guardar como copia
        </button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReaderToolbarComponent {
  readonly fileName = input.required<string>();
  readonly currentPage = input.required<number>();
  readonly pageCount = input.required<number>();
  readonly scalePercent = input.required<number>();
  readonly spreadMode = input.required<SpreadModeSetting>();
  readonly canUseDoublePage = input.required<boolean>();
  readonly isReady = input.required<boolean>();
  readonly canSave = input.required<boolean>();
  readonly isSaving = input.required<boolean>();
  readonly hasUnsavedChanges = input.required<boolean>();
  readonly canWriteInPlace = input.required<boolean>();
  readonly isDarkTheme = input.required<boolean>();
  readonly isFullscreen = input.required<boolean>();
  readonly canUseFullscreen = input.required<boolean>();

  readonly zoomIn = output();
  readonly zoomOut = output();
  readonly spreadModeChange = output<SpreadModeSetting>();
  readonly save = output();
  readonly saveCopy = output();
  readonly openAliasSettings = output();
  readonly themeToggled = output();
  readonly fullscreenToggled = output();

  /** Single interpolation so the rendered text has no surrounding whitespace. */
  protected readonly pageLabel = computed(
    () => `Página ${this.currentPage()} / ${this.pageCount()}`,
  );
  protected readonly themeLabel = computed(() =>
    this.isDarkTheme() ? 'Activar tema claro' : 'Activar tema oscuro',
  );
  protected readonly fullscreenLabel = computed(() =>
    this.isFullscreen() ? 'Salir de pantalla completa' : 'Ver en pantalla completa',
  );

  protected readonly buttonClass =
    'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
  protected readonly activeButtonClass =
    'rounded-md border border-blue-600 bg-blue-50 px-2.5 py-1 text-sm text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300';
  protected readonly iconButtonClass =
    'rounded-md border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';
}
