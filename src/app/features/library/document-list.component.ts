import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { StoredDocument } from '../../core/models/stored-document.model';
import { documentMetadata } from './document-metadata';
import { LIBRARY_MESSAGES } from './library-store.service';

/** Compact view of the library: one row per document. */
@Component({
  selector: 'app-document-list',
  template: `
    <ul
      class="divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
    >
      @for (document of documents(); track document.id) {
        <li class="flex items-center gap-4 px-4 py-3">
          <button
            type="button"
            class="min-w-0 flex-1 text-left"
            (click)="open.emit(document)"
            [disabled]="isUnavailable(document)"
            [class.opacity-60]="isUnavailable(document)"
          >
            <span class="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{{
              document.name
            }}</span>
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {{ metadata(document) }}
              @if (isUnavailable(document)) {
                · <span class="text-red-700 dark:text-red-300">{{ messages.unavailable }}</span>
              }
            </span>
          </button>

          @if (isUnavailable(document) && canRelink()) {
            <button
              type="button"
              class="text-sm text-blue-700 dark:text-blue-300 hover:underline"
              (click)="relink.emit(document)"
            >
              Seleccionar archivo
            </button>
          }

          <button
            type="button"
            class="rounded-md p-1.5 hover:bg-red-50 dark:hover:bg-red-950"
            (click)="remove.emit(document)"
            [attr.aria-label]="'Eliminar ' + document.name"
            title="Quitar de la biblioteca"
          >
            <!-- The button already has an accessible name, so the icon is decorative. -->
            <img
              src="icons/delete.svg"
              alt=""
              class="icon-neutral h-5 w-5"
              width="24"
              height="24"
            />
          </button>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentListComponent {
  readonly documents = input.required<readonly StoredDocument[]>();
  readonly unavailableIds = input.required<ReadonlySet<string>>();
  readonly canRelink = input.required<boolean>();

  readonly open = output<StoredDocument>();
  readonly remove = output<StoredDocument>();
  readonly relink = output<StoredDocument>();

  protected readonly messages = LIBRARY_MESSAGES;
  protected readonly metadata = documentMetadata;

  protected isUnavailable(document: StoredDocument): boolean {
    return this.unavailableIds().has(document.id);
  }
}
