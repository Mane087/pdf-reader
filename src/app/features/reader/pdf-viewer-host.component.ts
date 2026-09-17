import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

import { PdfViewerAdapter } from './pdf-viewer-adapter.service';

/**
 * Mounts the PDF.js `PDFViewer`. The only component that owns viewer DOM;
 * everything else talks to `PdfViewerAdapter`.
 */
@Component({
  selector: 'app-pdf-viewer-host',
  template: `
    <div #container class="pdf-viewer-container" tabindex="0" aria-label="Documento PDF">
      <div #viewer class="pdfViewer"></div>
    </div>
  `,
  host: { class: 'relative block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerHostComponent {
  private readonly adapter = inject(PdfViewerAdapter);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('container');
  private readonly viewer = viewChild.required<ElementRef<HTMLDivElement>>('viewer');

  constructor() {
    // PDFViewer needs the container in the DOM and absolutely positioned.
    afterNextRender(() => {
      const container = this.container().nativeElement;
      this.adapter.attach(container, this.viewer().nativeElement);
      container.focus();
    });
  }
}
