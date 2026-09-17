import { StoredDocument } from '../models/stored-document.model';
import { DocumentRepository } from '../storage/document-repository.service';
import { DocumentSource, DocumentUnavailableError } from './document-source';
import { FileHandleSource } from './file-handle-source';
import { StoredBlobSource } from './stored-blob-source';

export function createDocumentSource(
  document: StoredDocument,
  repository: DocumentRepository,
): DocumentSource {
  if (document.sourceKind === 'file-handle' && document.handle) {
    return new FileHandleSource(document.handle);
  }
  if (document.sourceKind === 'stored-blob' && document.blob) {
    return new StoredBlobSource(document.blob, document.name, async (blob) => {
      await repository.update(document.id, { blob, sizeBytes: blob.size });
    });
  }
  throw new DocumentUnavailableError();
}
