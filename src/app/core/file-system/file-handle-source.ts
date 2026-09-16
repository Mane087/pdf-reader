import {
  DocumentPermissionDeniedError,
  DocumentSource,
  DocumentUnavailableError,
  isDomExceptionNamed,
} from './document-source';

/** File System Access API (Chromium): reads and writes the original file through its handle. */
export class FileHandleSource implements DocumentSource {
  readonly kind = 'file-handle' as const;
  readonly canWriteInPlace = true;

  constructor(private readonly handle: FileSystemFileHandle) {}

  /**
   * `requestPermission` only works inside a user gesture; outside one Chromium
   * rejects with a `SecurityError`, which is reported as a denied permission.
   */
  async ensurePermission(mode: FileSystemPermissionMode): Promise<void> {
    const descriptor: FileSystemHandlePermissionDescriptor = { mode };
    let state = await this.handle.queryPermission(descriptor);
    if (state !== 'granted') {
      try {
        state = await this.handle.requestPermission(descriptor);
      } catch {
        throw new DocumentPermissionDeniedError();
      }
    }
    if (state !== 'granted') {
      throw new DocumentPermissionDeniedError();
    }
  }

  /** Requested from the "Guardar" click so that the prompt (if any) is allowed. */
  requestWriteAccess(): Promise<void> {
    return this.ensurePermission('readwrite');
  }

  async read(): Promise<Uint8Array<ArrayBuffer>> {
    await this.ensurePermission('read');
    try {
      const file = await this.handle.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch (error) {
      throw translateHandleError(error);
    }
  }

  /** The browser writes to a temporary file and swaps it on `close()`, so a failure leaves the original intact. */
  async write(bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    await this.ensurePermission('readwrite');
    let writable: FileSystemWritableFileStream;
    try {
      writable = await this.handle.createWritable();
    } catch (error) {
      throw translateHandleError(error);
    }
    try {
      await writable.write(bytes);
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => undefined);
      throw error;
    }
  }
}

function translateHandleError(error: unknown): unknown {
  if (isDomExceptionNamed(error, 'NotFoundError')) {
    return new DocumentUnavailableError();
  }
  if (isDomExceptionNamed(error, 'NotAllowedError')) {
    return new DocumentPermissionDeniedError();
  }
  return error;
}
