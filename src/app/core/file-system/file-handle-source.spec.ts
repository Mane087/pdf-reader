import { DocumentPermissionDeniedError, DocumentUnavailableError } from './document-source';
import { FileHandleSource } from './file-handle-source';

interface FakeWritable {
  write: jest.Mock;
  close: jest.Mock;
  abort: jest.Mock;
}

interface FakeHandle {
  queryPermission: jest.Mock;
  requestPermission: jest.Mock;
  getFile: jest.Mock;
  createWritable: jest.Mock;
}

const FILE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function makeWritable(): FakeWritable {
  return {
    write: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
  };
}

function makeHandle(writable: FakeWritable): FakeHandle {
  return {
    queryPermission: jest.fn().mockResolvedValue('granted'),
    requestPermission: jest.fn().mockResolvedValue('granted'),
    getFile: jest
      .fn()
      .mockResolvedValue(new File([FILE_BYTES], 'document.pdf', { type: 'application/pdf' })),
    createWritable: jest.fn().mockResolvedValue(writable),
  };
}

function makeSource(handle: FakeHandle): FileHandleSource {
  return new FileHandleSource(handle as unknown as FileSystemFileHandle);
}

describe('FileHandleSource', () => {
  let writable: FakeWritable;
  let handle: FakeHandle;
  let source: FileHandleSource;

  beforeEach(() => {
    writable = makeWritable();
    handle = makeHandle(writable);
    source = makeSource(handle);
  });

  it('declares that it writes over the original file', () => {
    expect(source.kind).toBe('file-handle');
    expect(source.canWriteInPlace).toBe(true);
  });

  describe('read', () => {
    it('returns the bytes of the file and only asks for read permission', async () => {
      const bytes = await source.read();

      expect(Array.from(bytes)).toEqual(Array.from(FILE_BYTES));
      expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'read' });
      expect(handle.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission when it has not been granted yet', async () => {
      handle.queryPermission.mockResolvedValue('prompt');

      await source.read();

      expect(handle.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('throws DocumentPermissionDeniedError when the user denies the prompt', async () => {
      handle.queryPermission.mockResolvedValue('prompt');
      handle.requestPermission.mockResolvedValue('denied');

      await expect(source.read()).rejects.toBeInstanceOf(DocumentPermissionDeniedError);
      expect(handle.getFile).not.toHaveBeenCalled();
    });

    it('throws DocumentPermissionDeniedError when the prompt cannot be shown', async () => {
      handle.queryPermission.mockResolvedValue('prompt');
      // Chromium rejects with a SecurityError outside a user gesture.
      handle.requestPermission.mockRejectedValue(new DOMException('no gesture', 'SecurityError'));

      await expect(source.read()).rejects.toBeInstanceOf(DocumentPermissionDeniedError);
    });

    it('throws DocumentUnavailableError when the file is gone', async () => {
      handle.getFile.mockRejectedValue(new DOMException('missing', 'NotFoundError'));

      await expect(source.read()).rejects.toBeInstanceOf(DocumentUnavailableError);
    });
  });

  describe('write', () => {
    it('asks for read and write permission and closes the stream', async () => {
      await source.write(FILE_BYTES);

      expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(writable.write).toHaveBeenCalledWith(FILE_BYTES);
      expect(writable.close).toHaveBeenCalledTimes(1);
      expect(writable.abort).not.toHaveBeenCalled();
    });

    it('aborts the stream and rethrows when writing fails, leaving the original intact', async () => {
      const failure = new Error('disk full');
      writable.write.mockRejectedValue(failure);

      await expect(source.write(FILE_BYTES)).rejects.toBe(failure);
      expect(writable.abort).toHaveBeenCalledTimes(1);
      expect(writable.close).not.toHaveBeenCalled();
    });

    it('does not open a stream when the write permission is denied', async () => {
      handle.queryPermission.mockResolvedValue('prompt');
      handle.requestPermission.mockResolvedValue('denied');

      await expect(source.write(FILE_BYTES)).rejects.toBeInstanceOf(DocumentPermissionDeniedError);
      expect(handle.createWritable).not.toHaveBeenCalled();
    });

    it('reports a missing file as unavailable', async () => {
      handle.createWritable.mockRejectedValue(new DOMException('missing', 'NotFoundError'));

      await expect(source.write(FILE_BYTES)).rejects.toBeInstanceOf(DocumentUnavailableError);
    });
  });

  describe('requestWriteAccess', () => {
    it('asks for the read and write permission ahead of the save', async () => {
      await source.requestWriteAccess();

      expect(handle.queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    });

    it('fails when the permission is denied', async () => {
      handle.queryPermission.mockResolvedValue('denied');
      handle.requestPermission.mockResolvedValue('denied');

      await expect(source.requestWriteAccess()).rejects.toBeInstanceOf(
        DocumentPermissionDeniedError,
      );
    });
  });
});
