import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

import { TestBed } from '@angular/core/testing';

import { StoredDocument } from '../models/stored-document.model';
import { DocumentRepository } from './document-repository.service';

function makeDocument(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: 'doc-1',
    name: 'document.pdf',
    sizeBytes: 1024,
    pageCount: 3,
    addedAt: 1000,
    lastOpenedAt: 1000,
    lastPage: 1,
    sourceKind: 'stored-blob',
    blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    ...overrides,
  };
}

/** `toEqual` does not compare Blob content meaningfully, so metadata and content are asserted separately. */
async function expectSameDocument(
  actual: StoredDocument | null,
  expected: StoredDocument,
): Promise<void> {
  expect(actual).not.toBeNull();
  const { blob: actualBlob, ...actualRest } = actual!;
  const { blob: expectedBlob, ...expectedRest } = expected;
  expect(actualRest).toEqual(expectedRest);
  expect(actualBlob?.type).toBe(expectedBlob?.type);
  await expect(actualBlob?.text()).resolves.toBe(await expectedBlob?.text());
}

describe('DocumentRepository', () => {
  beforeEach(() => {
    indexedDB = new IDBFactory();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns an empty list when there are no documents', async () => {
    const repository = TestBed.inject(DocumentRepository);

    await expect(repository.list()).resolves.toEqual([]);
  });

  it('returns a saved document through get', async () => {
    const repository = TestBed.inject(DocumentRepository);
    const document = makeDocument();

    await repository.save(document);

    const stored = await repository.get('doc-1');
    await expectSameDocument(stored, document);
  });

  it('returns null from get for an unknown id', async () => {
    const repository = TestBed.inject(DocumentRepository);

    await expect(repository.get('missing')).resolves.toBeNull();
  });

  it('lists documents sorted by lastOpenedAt descending', async () => {
    const repository = TestBed.inject(DocumentRepository);
    const older = makeDocument({ id: 'doc-old', lastOpenedAt: 1000 });
    const newer = makeDocument({ id: 'doc-new', lastOpenedAt: 5000 });

    await repository.save(older);
    await repository.save(newer);

    const documents = await repository.list();

    expect(documents.map((doc) => doc.id)).toEqual(['doc-new', 'doc-old']);
  });

  it('merges changes on update and keeps the id', async () => {
    const repository = TestBed.inject(DocumentRepository);
    const document = makeDocument();
    await repository.save(document);

    const updated = await repository.update('doc-1', { lastPage: 7 });

    await expectSameDocument(updated, { ...document, lastPage: 7, id: 'doc-1' });
    const stored = await repository.get('doc-1');
    expect(stored?.lastPage).toBe(7);
    expect(stored?.id).toBe('doc-1');
  });

  it('returns null from update for an unknown id', async () => {
    const repository = TestBed.inject(DocumentRepository);

    await expect(repository.update('missing', { lastPage: 7 })).resolves.toBeNull();
  });

  it('removes a document', async () => {
    const repository = TestBed.inject(DocumentRepository);
    const document = makeDocument();
    await repository.save(document);

    await repository.remove('doc-1');

    await expect(repository.get('doc-1')).resolves.toBeNull();
  });

  it('reports isAvailable as true after successfully opening the database', async () => {
    const repository = TestBed.inject(DocumentRepository);

    await repository.list();

    expect(repository.isAvailable()).toBe(true);
  });

  it('hasSpaceFor returns true when navigator.storage is undefined', async () => {
    const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true });
    const repository = TestBed.inject(DocumentRepository);

    await expect(repository.hasSpaceFor(1024)).resolves.toBe(true);

    if (originalStorage) {
      Object.defineProperty(navigator, 'storage', originalStorage);
    }
  });
});
