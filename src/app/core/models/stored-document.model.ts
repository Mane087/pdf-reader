export type DocumentSourceKind = 'file-handle' | 'stored-blob';

export interface StoredDocument {
  /** Generated with `crypto.randomUUID()`. */
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number | null;
  addedAt: number;
  lastOpenedAt: number;
  lastPage: number;
  sourceKind: DocumentSourceKind;
  /** First page rendered as a data URL, shown in the preview view of the library. */
  thumbnailDataUrl?: string;
  /** Only for `file-handle` (File System Access API, Chromium). */
  handle?: FileSystemFileHandle;
  /** Only for `stored-blob` (copy of the file kept in IndexedDB). */
  blob?: Blob;
}
