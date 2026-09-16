import '@testing-library/jest-dom';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();

/*
 * jsdom (26.x) does not implement a few browser APIs this project relies on.
 * They are polyfilled here so specs exercise the real production code instead
 * of working around the gaps one by one.
 */

// `Blob.arrayBuffer()` / `Blob.text()`: not implemented by jsdom, but FileReader is.
function readBlob<T extends ArrayBuffer | string>(
  blob: Blob,
  as: 'arrayBuffer' | 'text',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as T);
    reader.onerror = () => reject(reader.error);
    if (as === 'arrayBuffer') {
      reader.readAsArrayBuffer(blob);
    } else {
      reader.readAsText(blob);
    }
  });
}

if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
    return readBlob<ArrayBuffer>(this, 'arrayBuffer');
  };
}

if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob) {
    return readBlob<string>(this, 'text');
  };
}

// jsdom has no layout engine, so Range measurement returns an empty rect.
// Specs that need real coordinates spy on this method.
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  const emptyRect = (): DOMRect => new DOMRect(0, 0, 0, 0);
  Range.prototype.getBoundingClientRect = emptyRect;
  Range.prototype.getClientRects = () => {
    const list: DOMRect[] = [];
    return Object.assign(list, {
      item: (index: number) => list[index] ?? null,
    }) as unknown as DOMRectList;
  };
}

// `structuredClone` is missing in jsdom; fake-indexeddb needs it to store records.
if (typeof globalThis.structuredClone !== 'function') {
  const cloneValue = (value: unknown, seen: WeakMap<object, unknown>): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    const seenClone = seen.get(value);
    if (seenClone !== undefined) {
      return seenClone;
    }
    // Blobs and Files are immutable, so sharing the instance is equivalent to cloning it.
    if (
      value instanceof Blob ||
      value instanceof Date ||
      ArrayBuffer.isView(value) ||
      value instanceof ArrayBuffer
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      const clone: unknown[] = [];
      seen.set(value, clone);
      value.forEach((item, index) => (clone[index] = cloneValue(item, seen)));
      return clone;
    }
    if (value instanceof Map) {
      const clone = new Map<unknown, unknown>();
      seen.set(value, clone);
      value.forEach((item, key) => clone.set(cloneValue(key, seen), cloneValue(item, seen)));
      return clone;
    }
    if (value instanceof Set) {
      const clone = new Set<unknown>();
      seen.set(value, clone);
      value.forEach((item) => clone.add(cloneValue(item, seen)));
      return clone;
    }
    const clone: Record<string, unknown> = {};
    seen.set(value, clone);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      clone[key] = cloneValue(item, seen);
    }
    return clone;
  };
  globalThis.structuredClone = ((value: unknown) =>
    cloneValue(value, new WeakMap())) as typeof structuredClone;
}
