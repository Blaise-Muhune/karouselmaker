/**
 * Convert HEIC/HEIF buffer to JPEG when the optional "heic-convert" package is available.
 * Returns null if the package is not installed or conversion fails (build works without it).
 */
export async function convertHeicToJpeg(inputBuffer: Buffer): Promise<Buffer | null> {
  try {
    const convert = (await import("heic-convert")).default as (opts: {
      buffer: Buffer;
      format: "JPEG" | "PNG";
      quality?: number;
    }) => Promise<Buffer>;
    const output = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    });
    return Buffer.isBuffer(output) ? output : null;
  } catch {
    return null;
  }
}

export const HEIC_MIME_TYPES = ["image/heic", "image/heif"] as const;
export function isHeicMime(mime: string | undefined): boolean {
  if (!mime) return false;
  const lower = mime.toLowerCase();
  return lower === "image/heic" || lower === "image/heif";
}
