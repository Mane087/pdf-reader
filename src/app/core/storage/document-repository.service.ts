import { Injectable, computed, signal } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';

import { StoredDocument } from '../models/stored-document.model';

export const DOCUMENTS_DB_NAME = 'pdf-reader';
export const DOCUMENTS_DB_VERSION = 1;
const DOCUMENTS_STORE = 'documents';

interface PdfReaderDatabase extends DBSchema {
  documents: {
    key: string;
    value: StoredDocument;
    indexes: { lastOpenedAt: number };
  };
}

/**
 * Persists the library in IndexedDB. `FileSystemFileHandle` and `Blob` values are
 * structured-cloneable, so they are stored inside the record.
 *
 * When IndexedDB is unavailable (some private windows) the repository keeps the
 * records in memory for the session and reports `isAvailable() === false`.
 */
@Injectable({ providedIn: 'root' })
export class DocumentRepository {
  private databasePromise: Promise<IDBPDatabase<PdfReaderDatabase> | null> | null = null;
  private readonly sessionDocuments = new Map<string, StoredDocument>();
  private readonly availabilityState = signal<boolean | null>(null);

  /** `false` only after an open attempt failed; `true` before the first attempt to avoid flashing warnings. */
  readonly isAvailable = computed(() => this.availabilityState() !== false);

  async list(): Promise<StoredDocument[]> {
    const database = await this.openDatabase();
    const documents = database
      ? await database.getAll(DOCUMENTS_STORE)
      : [...this.sessionDocuments.values()];
    return documents.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }

  async get(id: string): Promise<StoredDocument | null> {
    const database = await this.openDatabase();
    if (!database) {
      return this.sessionDocuments.get(id) ?? null;
    }
    return (await database.get(DOCUMENTS_STORE, id)) ?? null;
  }

  async save(document: StoredDocument): Promise<void> {
    const database = await this.openDatabase();
    if (!database) {
      this.sessionDocuments.set(document.id, document);
      return;
    }
    await database.put(DOCUMENTS_STORE, document);
  }

  async update(
    id: string,
    changes: Partial<Omit<StoredDocument, 'id'>>,
  ): Promise<StoredDocument | null> {
    const current = await this.get(id);
    if (!current) {
      return null;
    }
    const updated: StoredDocument = { ...current, ...changes, id };
    await this.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const database = await this.openDatabase();
    if (!database) {
      this.sessionDocuments.delete(id);
      return;
    }
    await database.delete(DOCUMENTS_STORE, id);
  }

  /** Asks the browser not to evict the origin's storage. Returns the resulting state. */
  async requestPersistentStorage(): Promise<boolean> {
    try {
      if (!navigator.storage?.persist) {
        return false;
      }
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  /** `true` when the quota is unknown or leaves room for `bytes`. */
  async hasSpaceFor(bytes: number): Promise<boolean> {
    try {
      if (!navigator.storage?.estimate) {
        return true;
      }
      const { quota, usage } = await navigator.storage.estimate();
      if (quota === undefined || usage === undefined) {
        return true;
      }
      return quota - usage > bytes;
    } catch {
      return true;
    }
  }

  private openDatabase(): Promise<IDBPDatabase<PdfReaderDatabase> | null> {
    this.databasePromise ??= this.tryOpenDatabase();
    return this.databasePromise;
  }

  private async tryOpenDatabase(): Promise<IDBPDatabase<PdfReaderDatabase> | null> {
    if (typeof indexedDB === 'undefined') {
      this.availabilityState.set(false);
      return null;
    }
    try {
      const database = await openDB<PdfReaderDatabase>(DOCUMENTS_DB_NAME, DOCUMENTS_DB_VERSION, {
        upgrade(db) {
          const store = db.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
          store.createIndex('lastOpenedAt', 'lastOpenedAt');
        },
      });
      this.availabilityState.set(true);
      return database;
    } catch {
      this.availabilityState.set(false);
      return null;
    }
  }
}
