/**
 * Trigger a file download in browser environments (UI/IO layer — kept outside pure src/resolver/).
 */
export function triggerBrowserDownload(
  fileName: string,
  content: string | Blob | Uint8Array,
  mimeType: string,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob =
    content instanceof Blob
      ? content
      : new Blob([content as unknown as BlobPart], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
