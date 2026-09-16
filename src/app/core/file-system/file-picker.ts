import { isDomExceptionNamed } from './document-source';

const PDF_PICKER_TYPES: FilePickerAcceptType[] = [
  { description: 'Documentos PDF', accept: { 'application/pdf': ['.pdf'] } },
];

/** Capability detection; never based on the user agent. */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/** Returns `null` when the user cancels the dialog. */
export async function pickPdfFileHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: PDF_PICKER_TYPES,
      multiple: false,
      excludeAcceptAllOption: true,
    });
    return handle ?? null;
  } catch (error) {
    if (isDomExceptionNamed(error, 'AbortError')) {
      return null;
    }
    throw error;
  }
}

/** Returns `null` when the user cancels the dialog. */
export async function pickSaveFileHandle(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker({ suggestedName, types: PDF_PICKER_TYPES });
  } catch (error) {
    if (isDomExceptionNamed(error, 'AbortError')) {
      return null;
    }
    throw error;
  }
}

/** Drag & drop: a real handle in Chromium, `null` elsewhere (callers fall back to `DataTransfer.files`). */
export async function getDroppedFileHandle(
  item: DataTransferItem,
): Promise<FileSystemFileHandle | null> {
  if (typeof item.getAsFileSystemHandle !== 'function') {
    return null;
  }
  const handle = await item.getAsFileSystemHandle();
  return handle && handle.kind === 'file' ? (handle as FileSystemFileHandle) : null;
}
