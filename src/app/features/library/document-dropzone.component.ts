import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { formatFileSize, MAX_PDF_FILE_SIZE_BYTES } from '../../core/files/pdf-file-validation';
import {
  getDroppedFileHandle,
  pickPdfFileHandle,
  supportsFileSystemAccess,
} from '../../core/file-system/file-picker';
import { PickedDocument } from './library-store.service';

/**
 * File picker + drag & drop. Produces a `FileSystemFileHandle` in Chromium
 * (no copy of the file) and a `File` elsewhere.
 */
@Component({
  selector: 'app-document-dropzone',
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors"
      [class]="dragStateClass()"
      (dragover)="onDragOver($event)"
      (dragleave)="isDragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <p class="text-sm text-slate-600 dark:text-slate-400">
        Arrastra un archivo aquí o usa "Agregar PDF".
      </p>
      <p class="text-xs text-slate-500 dark:text-slate-400">Tamaño máximo: {{ maxSizeLabel }}</p>
      <button
        type="button"
        class="rounded-md cursor-pointer bg-blue-600 dark:bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
        [disabled]="isBusy()"
        (click)="openPicker()"
      >
        @if (isBusy()) {
          Agregando…
        } @else {
          + Agregar PDF
        }
      </button>
      <input
        #fileInput
        type="file"
        accept="application/pdf,.pdf"
        class="hidden"
        (change)="onInputChange($event)"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDropzoneComponent {
  readonly isBusy = input(false);
  readonly documentPicked = output<PickedDocument>();

  protected readonly isDragOver = signal(false);
  /** Merged with the static class list; highlights the border while a file hovers the zone. */
  protected readonly dragStateClass = computed(() =>
    this.isDragOver()
      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950'
      : 'border-slate-300 dark:border-slate-600',
  );
  protected readonly maxSizeLabel = formatFileSize(MAX_PDF_FILE_SIZE_BYTES);
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  async openPicker(): Promise<void> {
    if (!supportsFileSystemAccess()) {
      this.fileInput().nativeElement.click();
      return;
    }
    const handle = await pickPdfFileHandle();
    if (handle) {
      this.documentPicked.emit({ kind: 'file-handle', handle });
    }
  }

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.documentPicked.emit({ kind: 'file', file });
    }
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragOver.set(false);
    const item = event.dataTransfer?.items?.[0];
    if (item) {
      const handle = await getDroppedFileHandle(item);
      if (handle) {
        this.documentPicked.emit({ kind: 'file-handle', handle });
        return;
      }
    }
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.documentPicked.emit({ kind: 'file', file });
    }
  }
}
