import { DocumentSource } from './document-source';
import { downloadBytes } from './download-file';

/**
 * Browsers without File System Access (Firefox, Safari): the document is a copy
 * kept in IndexedDB. Saving updates that copy and downloads the file.
 */
export class StoredBlobSource implements DocumentSource {
  readonly kind = 'stored-blob' as const;
  readonly canWriteInPlace = false;

  constructor(
    private blob: Blob,
    private readonly fileName: string,
    private readonly persistBlob: (blob: Blob) => Promise<void>,
  ) {}

  requestWriteAccess(): Promise<void> {
    return Promise.resolve();
  }

  async read(): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await this.blob.arrayBuffer());
  }

  /** The local copy is updated even when the user cancels the download. */
  async write(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    await this.persistBlob(blob);
    this.blob = blob;
    downloadBytes(this.fileName, bytes);
  }
}
