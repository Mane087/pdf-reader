import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

/**
 * Exposes the latest `window` event of the given type as a signal.
 * Must be called in an injection context (field initializer or constructor);
 * the listener is removed when that context is destroyed.
 */
export function windowEventSignal<K extends keyof WindowEventMap>(
  type: K,
  options?: AddEventListenerOptions,
): Signal<WindowEventMap[K] | undefined> {
  return toSignal(createEventObservable<WindowEventMap[K]>(window, type, options));
}

/** Same as `windowEventSignal`, for events dispatched on `document` (e.g. `selectionchange`). */
export function documentEventSignal<K extends keyof DocumentEventMap>(
  type: K,
  options?: AddEventListenerOptions,
): Signal<DocumentEventMap[K] | undefined> {
  return toSignal(createEventObservable<DocumentEventMap[K]>(document, type, options));
}

function createEventObservable<E>(
  target: Window | Document,
  type: string,
  options?: AddEventListenerOptions,
) {
  return options ? fromEvent<E>(target, type, options) : fromEvent<E>(target, type);
}
