const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 85;

export type ProcessImageResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

function getExtensionFromMime(mime: string | undefined): string {
  if (!mime) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Resize (max 1920px) and compress image to JPEG for storage when sharp is installed.
 * If sharp is not installed, returns the original buffer (build works without sharp).
 */
export async function processImageBuffer(
  inputBuffer: Buffer,
  inputMime?: string
): Promise<ProcessImageResult> {
  let sharp: (input: Buffer, opts?: { failOnError?: boolean }) => { resize: (w: number, h: number, opts: unknown) => { jpeg: (opts: { quality: number }) => { toBuffer: () => Promise<Buffer> } } };
  try {
    sharp = (await import("sharp")).default as typeof sharp;
  } catch {
    return {
      buffer: inputBuffer,
      mimeType: inputMime ?? "image/jpeg",
      extension: getExtensionFromMime(inputMime),
    };
  }

  const pipeline = sharp(inputBuffer, { failOnError: true })
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY });

  const buffer = await pipeline.toBuffer();
  return {
    buffer,
    mimeType: "image/jpeg",
    extension: "jpg",
  };
}
