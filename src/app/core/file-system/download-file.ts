/** Triggers a browser download of `bytes` with the given file name. */
export function downloadBytes(fileName: string, bytes: Uint8Array<ArrayBuffer>): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser time to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
