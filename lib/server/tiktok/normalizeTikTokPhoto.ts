import sharp from "sharp";

/** TikTok Photo Mode: JPEG/WebP only, max 1080p on either side. */
const TIKTOK_MAX_EDGE = 1080;

function isJpeg(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Buffer): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/**
 * Normalize export bytes for TikTok Photo Mode:
 * - JPEG (preferred) or WebP
 * - Longest edge capped at 1080 (TikTok “Maximum 1080p”)
 *
 * Always re-encodes through sharp so 1080×1350 feed exports become ≤1080 on both sides.
 */
export async function normalizeTikTokPhoto(
  image: Buffer
): Promise<{ bytes: Buffer; contentType: "image/jpeg" | "image/webp" }> {
  if (!isJpeg(image) && !isWebp(image) && !isPng(image)) {
    throw new Error("Scheduled export is not a supported image.");
  }

  const bytes = await sharp(image, { failOnError: true })
    .rotate()
    .resize(TIKTOK_MAX_EDGE, TIKTOK_MAX_EDGE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  return { bytes, contentType: "image/jpeg" };
}
