import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { StoredDocument } from '../../core/models/stored-document.model';
import { documentPreviewMetadata } from './document-metadata';
import { LIBRARY_MESSAGES } from './library-store.service';

/** Preview view of the library: a tile per document with its first page. */
@Component({
  selector: 'app-document-grid',
  template: `
    <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      @for (document of documents(); track document.id) {
        <li class="relative">
          <button
            type="button"
            class="flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-left hover:border-blue-400 dark:hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
            (click)="open.emit(document)"
            [disabled]="isUnavailable(document)"
            [class.opacity-60]="isUnavailable(document)"
          >
            <span
              class="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"
            >
              @if (document.thumbnailDataUrl; as thumbnail) {
                <img
                  [src]="thumbnail"
                  alt=""
                  class="h-full w-full object-cover object-top"
                  loading="lazy"
                />
              } @else {
                <img src="icons/preview.svg" alt="" class="icon-neutral h-10 w-10 opacity-50" />
              }
            </span>
            <span class="flex flex-col gap-0.5 p-3">
              <span class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{{
                document.name
              }}</span>
              <span class="truncate text-xs text-slate-500 dark:text-slate-400">{{
                metadata(document)
              }}</span>
              @if (isUnavailable(document)) {
                <span class="text-xs text-red-700 dark:text-red-300">{{
                  messages.unavailable
                }}</span>
              }
            </span>
          </button>

          <button
            type="button"
            class="absolute top-2 right-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 p-1.5 hover:bg-red-50 dark:hover:bg-red-950"
            (click)="remove.emit(document)"
            [attr.aria-label]="'Eliminar ' + document.name"
            title="Quitar de la biblioteca"
          >
            <img
              src="icons/delete.svg"
              alt=""
              class="icon-neutral h-5 w-5"
              width="24"
              height="24"
            />
          </button>

          @if (isUnavailable(document) && canRelink()) {
            <button
              type="button"
              class="mt-2 w-full text-sm text-blue-700 dark:text-blue-300 hover:underline"
              (click)="relink.emit(document)"
            >
              Seleccionar archivo
            </button>
          }
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentGridComponent {
  readonly documents = input.required<readonly StoredDocument[]>();
  readonly unavailableIds = input.required<ReadonlySet<string>>();
  readonly canRelink = input.required<boolean>();

  readonly open = output<StoredDocument>();
  readonly remove = output<StoredDocument>();
  readonly relink = output<StoredDocument>();

  protected readonly messages = LIBRARY_MESSAGES;
  protected readonly metadata = documentPreviewMetadata;

  protected isUnavailable(document: StoredDocument): boolean {
    return this.unavailableIds().has(document.id);
  }
}
