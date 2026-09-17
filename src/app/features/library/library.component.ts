import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { pickPdfFileHandle, supportsFileSystemAccess } from '../../core/file-system/file-picker';
import { StoredDocument } from '../../core/models/stored-document.model';
import {
  LibraryPreferencesStore,
  LibraryViewMode,
} from '../../core/storage/library-preferences-store.service';
import { DocumentDropzoneComponent } from './document-dropzone.component';
import { DocumentGridComponent } from './document-grid.component';
import { DocumentListComponent } from './document-list.component';
import { LIBRARY_MESSAGES, LibraryStore, PickedDocument } from './library-store.service';

const REMOVE_CONFIRMATION =
  'Se quitará el documento de la biblioteca. El archivo en tu equipo no se elimina. ¿Continuar?';

/**
 * Both views live in their own component and load on demand: `@if` decides
 * which one is visible and `@defer` keeps its code in a separate chunk, so
 * opening the library only downloads the view that is actually shown.
 *
 * `@defer` cannot replace `@if` here: a deferred block only moves forward, and
 * once rendered it stays rendered when its condition turns false again.
 */
@Component({
  selector: 'app-library',
  imports: [DocumentDropzoneComponent, DocumentListComponent, DocumentGridComponent],
  template: `
    <div class="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header class="flex items-center justify-between gap-4">
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Mis documentos</h1>

        <div
          class="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
          role="group"
          aria-label="Forma de ver los documentos"
        >
          <button
            type="button"
            [class]="viewMode() === 'list' ? activeViewButtonClass : viewButtonClass"
            [attr.aria-pressed]="viewMode() === 'list'"
            (click)="setViewMode('list')"
            aria-label="Ver como lista"
            title="Lista"
          >
            <img src="icons/list.svg" alt="" class="icon-neutral h-4 w-4" width="24" height="24" />
          </button>
          <button
            type="button"
            [class]="viewMode() === 'preview' ? activeViewButtonClass : viewButtonClass"
            [attr.aria-pressed]="viewMode() === 'preview'"
            (click)="setViewMode('preview')"
            aria-label="Ver con vista previa"
            title="Vista previa"
          >
            <img
              src="icons/preview.svg"
              alt=""
              class="icon-neutral h-4 w-4"
              width="24"
              height="24"
            />
          </button>
        </div>
      </header>

      @if (!store.isPersistent()) {
        <p
          class="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
          role="status"
        >
          {{ messages.sessionOnly }}
        </p>
      }

      @if (store.error(); as error) {
        <div
          class="flex items-center gap-3 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <span class="flex-1">{{ error }}</span>
          <button
            type="button"
            class="rounded px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900"
            (click)="store.dismissError()"
            aria-label="Cerrar aviso"
          >
            ✕
          </button>
        </div>
      }

      <app-document-dropzone
        [isBusy]="store.isAdding()"
        (documentPicked)="onDocumentPicked($event)"
      />

      @if (store.isLoading()) {
        <p class="text-sm text-slate-500 dark:text-slate-400" role="status">Cargando biblioteca…</p>
      } @else if (store.isEmpty()) {
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Todavía no hay documentos. Agrega un PDF para empezar.
        </p>
      } @else if (viewMode() === 'list') {
        @defer (on immediate) {
          <app-document-list
            [documents]="store.documents()"
            [unavailableIds]="store.unavailableIds()"
            [canRelink]="canRelink"
            (open)="open($event)"
            (remove)="remove($event)"
            (relink)="relink($event)"
          />
        } @placeholder {
          <p class="text-sm text-slate-500 dark:text-slate-400" role="status">
            Cargando documentos…
          </p>
        } @error {
          <p class="text-sm text-red-700 dark:text-red-300" role="alert">
            {{ messages.viewLoadFailed }}
          </p>
        }
      } @else {
        @defer (on immediate) {
          <app-document-grid
            [documents]="store.documents()"
            [unavailableIds]="store.unavailableIds()"
            [canRelink]="canRelink"
            (open)="open($event)"
            (remove)="remove($event)"
            (relink)="relink($event)"
          />
        } @placeholder {
          <p class="text-sm text-slate-500 dark:text-slate-400" role="status">
            Cargando vistas previas…
          </p>
        } @error {
          <p class="text-sm text-red-700 dark:text-red-300" role="alert">
            {{ messages.viewLoadFailed }}
          </p>
        }
      }
    </div>
  `,
  host: { class: 'block min-h-full bg-slate-50 dark:bg-slate-950' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryComponent implements OnInit {
  protected readonly store = inject(LibraryStore);
  protected readonly preferences = inject(LibraryPreferencesStore);
  private readonly router = inject(Router);

  protected readonly messages = LIBRARY_MESSAGES;
  protected readonly canRelink = supportsFileSystemAccess();
  protected readonly viewMode = this.preferences.viewMode;

  // The icons cannot inherit the text color, so the active view is shown with a background.
  protected readonly viewButtonClass =
    'rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800';
  protected readonly activeViewButtonClass = 'rounded-md bg-slate-200 p-1.5 dark:bg-slate-700';

  ngOnInit(): void {
    void this.store.load().then(() => this.generateThumbnailsWhenPreviewing());
  }

  protected setViewMode(mode: LibraryViewMode): void {
    this.preferences.setViewMode(mode);
    this.generateThumbnailsWhenPreviewing();
  }

  /** Documents stored before previews existed have no thumbnail yet. */
  private generateThumbnailsWhenPreviewing(): void {
    if (this.viewMode() === 'preview') {
      void this.store.generateMissingThumbnails();
    }
  }

  protected async onDocumentPicked(picked: PickedDocument): Promise<void> {
    const document = await this.store.addDocument(picked);
    if (document) {
      await this.router.navigate(['/reader', document.id]);
    }
  }

  protected async open(document: StoredDocument): Promise<void> {
    if (await this.store.prepareToOpen(document)) {
      await this.router.navigate(['/reader', document.id]);
    }
  }

  protected async relink(document: StoredDocument): Promise<void> {
    const handle = await pickPdfFileHandle();
    if (handle) {
      await this.store.relinkDocument(document.id, handle);
    }
  }

  protected async remove(document: StoredDocument): Promise<void> {
    if (window.confirm(REMOVE_CONFIRMATION)) {
      await this.store.removeDocument(document.id);
    }
  }
}
