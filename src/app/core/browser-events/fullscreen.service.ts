import { Injectable, effect, signal, untracked } from '@angular/core';

import { documentEventSignal } from './dom-event-signal';

/** Whether the browser allows this document to go fullscreen. */
export function isFullscreenSupported(): boolean {
  return (
    Boolean(document.fullscreenEnabled) &&
    typeof document.documentElement.requestFullscreen === 'function'
  );
}

function isDocumentFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

/**
 * Fullscreen state of the whole page. The document element is used as the target
 * so the toolbar stays visible while reading.
 */
@Injectable({ providedIn: 'root' })
export class FullscreenService {
  private readonly fullscreenChange = documentEventSignal('fullscreenchange');
  private readonly isFullscreenState = signal(isDocumentFullscreen());

  readonly isFullscreen = this.isFullscreenState.asReadonly();
  readonly canUseFullscreen = isFullscreenSupported();

  constructor() {
    effect(() => {
      this.fullscreenChange();
      untracked(() => this.isFullscreenState.set(isDocumentFullscreen()));
    });
  }

  async toggle(): Promise<void> {
    if (!this.canUseFullscreen) {
      return;
    }
    try {
      if (isDocumentFullscreen()) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // The browser rejects the request without a user gesture or when a
      // permissions policy forbids it. The state signal stays as it was.
    }
  }
}
