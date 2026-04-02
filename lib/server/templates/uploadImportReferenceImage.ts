import { countAssets, createAsset } from "@/lib/server/db";
import { getEffectivePlanLimits } from "@/lib/server/subscription";
import { processImageBuffer } from "@/lib/server/images/processImage";
import { uploadUserAsset } from "@/lib/server/storage/upload";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";
/** Match import action cap (~9MB source); decoded buffer upper bound. */
const MAX_DECODED_BYTES = 12 * 1024 * 1024;
/** Signed URL lifetime for embedded template preview (7 days). */
const SIGNED_URL_TTL_SECONDS = 604800;

export type UploadImportReferenceImageResult =
  | { ok: true; assetId: string; storagePath: string; signedUrl: string }
  | { ok: false; error: string };

/**
 * Persist the import screenshot as a user asset and return a signed URL for template.defaults.background.
 */
export async function uploadImportReferenceImage(
  userId: string,
  dataUrl: string,
  email: string | null
): Promise<UploadImportReferenceImageResult> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:image/")) {
    return { ok: false, error: "Invalid image data." };
  }

  let mime = "image/jpeg";
  let base64 = "";
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(trimmed);
  if (m) {
    mime = m[1]!.split(";")[0]!.trim() || "image/jpeg";
    base64 = m[2]!.replace(/\s/g, "");
  } else {
    return { ok: false, error: "Invalid image data." };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Invalid image data." };
  }
  if (buffer.length === 0 || buffer.length > MAX_DECODED_BYTES) {
    return { ok: false, error: "Image too large." };
  }

  const limits = await getEffectivePlanLimits(userId, email);
  const currentCount = await countAssets(userId);
  if (currentCount >= limits.assets) {
    return {
      ok: false,
      error: `Asset limit reached (${limits.assets}). Free space in your library or try again without embedding the import photo.`,
    };
  }

  let processed: Awaited<ReturnType<typeof processImageBuffer>>;
  try {
    processed = await processImageBuffer(buffer, mime);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Image could not be processed.";
    return { ok: false, error: msg };
  }

  const fileName = `import-ref.${processed.extension}`;
  const assetId = crypto.randomUUID();
  const storagePath = `user/${userId}/assets/${assetId}/${fileName}`;

  try {
    await createAsset(userId, {
      project_id: null,
      kind: "image",
      file_name: fileName,
      storage_path: storagePath,
      width: null,
      height: null,
      blurhash: null,
    });
    const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.mimeType });
    await uploadUserAsset(userId, assetId, blob, fileName, processed.mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed.";
    return { ok: false, error: msg };
  }

  try {
    const signedUrl = await getSignedImageUrl(BUCKET, storagePath, SIGNED_URL_TTL_SECONDS);
    return { ok: true, assetId, storagePath, signedUrl };
  } catch {
    return { ok: false, error: "Could not prepare image URL." };
  }
}
