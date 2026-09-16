import { DocumentSourceKind } from '../models/stored-document.model';

/** Where the bytes of an open document come from and where "Guardar" writes them. */
export interface DocumentSource {
  readonly kind: DocumentSourceKind;
  /** `true` when `write` replaces the original file on disk. */
  readonly canWriteInPlace: boolean;
  read(): Promise<Uint8Array<ArrayBuffer>>;
  /**
   * Requests write access while a user gesture is still active. Call it
   * before any long asynchronous work that precedes `write`.
   */
  requestWriteAccess(): Promise<void>;
  write(bytes: Uint8Array<ArrayBuffer>): Promise<void>;
}

/** The file behind a handle was moved or deleted. */
export class DocumentUnavailableError extends Error {
  constructor() {
    super(
      'El archivo ya no está disponible en el disco. Elimínalo de la biblioteca o vuelve a seleccionarlo.',
    );
    this.name = 'DocumentUnavailableError';
  }
}

/** The user denied the read/write permission for the file handle. */
export class DocumentPermissionDeniedError extends Error {
  constructor() {
    super(
      'Se necesita permiso para leer y escribir el archivo. Vuelve a intentarlo y acepta la solicitud.',
    );
    this.name = 'DocumentPermissionDeniedError';
  }
}

export function isDomExceptionNamed(error: unknown, name: string): boolean {
  return error instanceof DOMException && error.name === name;
}
