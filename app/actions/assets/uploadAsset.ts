"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getEffectivePlanLimits, hasFullProFeatureAccess } from "@/lib/server/subscription";
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

const MAX_FILES_PER_BATCH = 30;

export type UploadAssetsResult =
  | {
      ok: true;
      assetIds: string[];
      errors: { fileName: string; error: string }[];
    }
  | { ok: false; error: string };

/**
 * Upload multiple images in one action (same rules as `uploadAsset` per file).
 * Use FormData key `files` for each file (append multiple), optional `project_id`.
 */
export async function uploadAssets(
  formData: FormData,
  revalidatePathname?: string
): Promise<UploadAssetsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const files = formData.getAll("files").filter((x): x is File => x instanceof File);
  if (files.length === 0) return { ok: false, error: "No files provided" };

  const { isPro } = await getSubscription(user.id, user.email);
  const fullAccess = await hasFullProFeatureAccess(user.id, user.email);
  const limits = await getEffectivePlanLimits(user.id, user.email);
  let remaining = Math.max(0, limits.assets - (await countAssets(user.id)));

  const projectIdRaw = formData.get("project_id") as string | null;
  const projectId = projectIdRaw && projectIdRaw.trim() ? projectIdRaw.trim() : null;

  const assetIds: string[] = [];
  const errors: { fileName: string; error: string }[] = [];
  const sliced = files.slice(0, MAX_FILES_PER_BATCH);

  for (const file of sliced) {
    if (remaining <= 0) {
      errors.push({
        fileName: file.name,
        error: `Asset limit reached (${limits.assets}${isPro || fullAccess ? "" : " on free plan. Upgrade for more capacity."}).`,
      });
      continue;
    }
    const fd = new FormData();
    fd.set("file", file);
    if (projectId) fd.set("project_id", projectId);
    const r = await uploadAsset(fd, undefined);
    if (r.ok) {
      assetIds.push(r.assetId);
      remaining -= 1;
    } else {
      errors.push({ fileName: file.name, error: r.error });
    }
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);

  if (assetIds.length === 0) {
    const first = errors[0]?.error ?? "Upload failed";
    return { ok: false, error: errors.length > 1 ? `${first} (${errors.length} files failed.)` : first };
  }
  return { ok: true, assetIds, errors };
}

export async function uploadAsset(
  formData: FormData,
  revalidatePathname?: string
): Promise<UploadAssetResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { isPro } = await getSubscription(user.id, user.email);
  const fullAccess = await hasFullProFeatureAccess(user.id, user.email);
  const limits = await getEffectivePlanLimits(user.id, user.email);
  const currentCount = await countAssets(user.id);
  if (currentCount >= limits.assets) {
    return {
      ok: false,
      error: `Asset limit reached (${limits.assets}${isPro || fullAccess ? "" : " on free plan. Upgrade for more capacity."}).`,
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
