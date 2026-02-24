"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { createAsset, countAssets } from "@/lib/server/db";
import { uploadUserAsset } from "@/lib/server/storage/upload";
import { processImageBuffer } from "@/lib/server/images/processImage";
import { convertHeicToJpeg, isHeicMime } from "@/lib/server/images/convertHeic";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

/** Raw camera extensions we don't support (user should export as JPEG/PNG first). */
const RAW_EXTENSIONS = [".arw", ".awr", ".cr2", ".cr3", ".nef", ".ner", ".orf", ".raf", ".raw", ".dng"];
function isRawFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return RAW_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export type UploadAssetResult =
  | { ok: true; assetId: string; storagePath: string }
  | { ok: false; error: string };

export async function uploadAsset(
  formData: FormData,
  revalidatePathname?: string
): Promise<UploadAssetResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { isPro } = await getSubscription(user.id, user.email);
  const limits = await getPlanLimits(user.id, user.email);
  const currentCount = await countAssets(user.id);
  if (currentCount >= limits.assets) {
    return {
      ok: false,
      error: `Asset limit reached (${limits.assets}${isPro ? "" : " on free plan. Upgrade to Pro for more"}).`,
    };
  }

  const file = formData.get("file") as File | null;
  const projectIdRaw = formData.get("project_id") as string | null;
  const projectId = projectIdRaw && projectIdRaw.trim() ? projectIdRaw.trim() : null;

  if (!file || !(file instanceof File)) {
    return { ok: false, error: "No file provided" };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    if (isRawFileName(file.name)) {
      return { ok: false, error: "Raw camera formats (ARW, AWR, CR2, NEF, etc.) are not supported. Please export as JPEG or PNG first." };
    }
    return { ok: false, error: "File must be an image (JPEG, PNG, WebP, GIF, or HEIC)" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File must be 20MB or smaller" };
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  let mimeToProcess = file.type;
  if (isHeicMime(file.type)) {
    const jpegBuffer = await convertHeicToJpeg(buffer);
    if (!jpegBuffer) {
      return { ok: false, error: "HEIC conversion is not available. Install the heic-convert package or convert to JPEG on your device first." };
    }
    buffer = Buffer.from(jpegBuffer);
    mimeToProcess = "image/jpeg";
  }

  let processed: Awaited<ReturnType<typeof processImageBuffer>>;
  try {
    processed = await processImageBuffer(buffer, mimeToProcess);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Image could not be processed";
    return { ok: false, error: msg };
  }

  const baseName = (file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "image").replace(/\.[^.]+$/, "") || "image";
  const fileName = `${baseName}.${processed.extension}`;
  const assetId = crypto.randomUUID();
  const storagePath = `user/${user.id}/assets/${assetId}/${fileName}`;

  try {
    await createAsset(user.id, {
      project_id: projectId,
      kind: "image",
      file_name: fileName,
      storage_path: storagePath,
      width: null,
      height: null,
      blurhash: null,
    });
    const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.mimeType });
    await uploadUserAsset(user.id, assetId, blob, fileName, processed.mimeType);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, assetId, storagePath };
}
