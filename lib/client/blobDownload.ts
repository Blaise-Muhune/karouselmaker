/**
 * Client-only helpers for saving Blobs. Mobile Safari often drops downloads when the
 * object URL is revoked immediately or the anchor is not in the document.
 */

const DEFAULT_REVOKE_AFTER_MS = 600_000; // 10 min — large ZIPs / slow networks

/** iOS / iPadOS Safari (not Chrome/Firefox/Edge on iOS). */
export function isLikelyIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const maxTp = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints;
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (typeof navigator.platform === "string" && navigator.platform === "MacIntel" && typeof maxTp === "number" && maxTp > 1);
  if (!isIOSDevice) return false;
  return /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/**
 * Programmatic save: append `<a>` to `document.body`, click, remove, revoke URL after a delay.
 * Returns the object URL (same string passed to revoke later) for optional follow-up UI (e.g. iOS “Tap to save”).
 */
export function triggerBlobDownload(
  blob: Blob,
  filename: string,
  revokeAfterMs: number = DEFAULT_REVOKE_AFTER_MS
): string {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener noreferrer";
  a.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    a.remove();
  }
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, revokeAfterMs);
  return url;
}
