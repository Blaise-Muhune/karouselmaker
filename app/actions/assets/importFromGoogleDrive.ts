"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getPlanLimits } from "@/lib/server/subscription";
import { createAsset, countAssets } from "@/lib/server/db";
import { uploadUserAsset } from "@/lib/server/storage/upload";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import { processImageBuffer } from "@/lib/server/images/processImage";
import { convertHeicToJpeg, isHeicMime } from "@/lib/server/images/convertHeic";

const BUCKET = "carousel-assets";
const MAX_IMPORT_PER_REQUEST = 50;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB (Drive/phone photos often exceed 8MB)
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const SIGNED_URL_EXPIRES = 600;

export type ImportFromGoogleDriveResult =
  | { ok: true; assets: { id: string; storage_path: string; file_name: string; url: string }[] }
  | { ok: false; error: string };

/**
 * List image files in a Google Drive folder, then download each and create an asset.
 * Requires the user's Google access token with drive.file scope (folder selected in Picker).
 */
export async function importFromGoogleDrive(
  folderId: string,
  accessToken: string,
  projectId?: string | null,
  limit: number = MAX_IMPORT_PER_REQUEST
): Promise<ImportFromGoogleDriveResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Sign in to import from Google Drive." };

  const trimmedFolderId = folderId?.trim();
  if (!trimmedFolderId) return { ok: false, error: "No folder selected." };

  const limits = await getPlanLimits(user.id, user.email);
  const currentCount = await countAssets(user.id);
  const remaining = Math.max(0, limits.assets - currentCount);
  if (remaining === 0) {
    return { ok: false, error: `Asset limit reached (${limits.assets}). Delete some assets or upgrade to add more.` };
  }

  const cap = Math.min(limit, remaining, MAX_IMPORT_PER_REQUEST);
  const mimeQuery = IMAGE_MIME_TYPES.map((m) => `mimeType='${m}'`).join(" or ");
  const q = `'${trimmedFolderId}' in parents and (${mimeQuery}) and trashed=false`;
  const listParams = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType)",
    pageSize: String(cap),
    orderBy: "name",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const listUrl = `https://www.googleapis.com/drive/v3/files?${listParams.toString()}`;

  let listRes: Response;
  try {
    listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: `Could not list Drive folder: ${msg}` };
  }

  if (!listRes.ok) {
    const body = await listRes.text();
    if (listRes.status === 401) return { ok: false, error: "Google sign-in expired. Try “Import from Drive” again." };
    return { ok: false, error: `Google Drive error: ${listRes.status} ${body.slice(0, 200)}` };
  }

  type DriveFile = { id: string; name: string; mimeType?: string };
  const data = (await listRes.json()) as { files?: DriveFile[] };
  let files = data.files ?? [];

  // If no files with strict MIME filter, try listing all files in folder and filter to images (e.g. some Drive setups use different MIME or shared drives)
  if (files.length === 0) {
    const fallbackQ = `'${trimmedFolderId}' in parents and trashed=false`;
    const fallbackParams = new URLSearchParams({
      q: fallbackQ,
      fields: "files(id,name,mimeType)",
      pageSize: String(cap),
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const fallbackRes = await fetch(`https://www.googleapis.com/drive/v3/files?${fallbackParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (fallbackRes.ok) {
      const fallbackData = (await fallbackRes.json()) as { files?: DriveFile[] };
      const all = fallbackData.files ?? [];
      const imageExtensions = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
      files = all.filter(
        (f) =>
          IMAGE_MIME_TYPES.includes(f.mimeType ?? "") ||
          (f.name && imageExtensions.test(f.name))
      );
    }
  }

  if (files.length === 0) {
    return { ok: false, error: "No images found in that folder. Try “Pick images from Drive” and select the image files directly, or add JPEG, PNG, WebP, GIF, or HEIC files to the folder." };
  }

  const projectIdTrimmed = projectId && String(projectId).trim() ? String(projectId).trim() : null;
  const created: { id: string; storage_path: string; file_name: string; url: string }[] = [];
  const toProcess = files.slice(0, cap);

  for (const file of toProcess) {
    const mimeType = IMAGE_MIME_TYPES.includes(file.mimeType ?? "") ? file.mimeType! : "image/jpeg";
    const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;

    let fileRes: Response;
    try {
      fileRes = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (e) {
      continue; // skip failed file
    }
    if (!fileRes.ok) continue;

    let buffer = Buffer.from(await fileRes.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) continue;
    if (buffer.length === 0) continue;

    let mimeToProcess = mimeType;
    if (isHeicMime(mimeType)) {
      const jpegBuffer = await convertHeicToJpeg(buffer);
      if (!jpegBuffer) continue; // skip HEIC when conversion not available
      buffer = Buffer.from(jpegBuffer);
      mimeToProcess = "image/jpeg";
    }

    let processed: Awaited<ReturnType<typeof processImageBuffer>>;
    try {
      processed = await processImageBuffer(buffer, mimeToProcess);
    } catch {
      continue; // skip if image is corrupt or unsupported
    }

    const safeName = (file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
    const baseName = safeName.includes(".") ? safeName.replace(/\.[^.]+$/, "") : safeName;
    const fileName = `${baseName}.${processed.extension}`;
    const assetId = crypto.randomUUID();
    const storagePath = `user/${user.id}/assets/${assetId}/${fileName}`;

    try {
      await createAsset(user.id, {
        project_id: projectIdTrimmed,
        kind: "image",
        file_name: fileName,
        storage_path: storagePath,
        width: null,
        height: null,
        blurhash: null,
      });
      const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.mimeType });
      await uploadUserAsset(user.id, assetId, blob, fileName, processed.mimeType);
      const url = await getSignedImageUrl(BUCKET, storagePath, SIGNED_URL_EXPIRES);
      created.push({ id: assetId, storage_path: storagePath, file_name: fileName, url });
    } catch {
      // skip this file on error
    }
  }

  if (created.length === 0) {
    return { ok: false, error: "Could not import any images. Files may be over 20MB, or download failed. Try smaller images or pick a different folder." };
  }

  return { ok: true, assets: created };
}

/**
 * Import multiple image files from Google Drive by file IDs (e.g. from Picker multi-file selection).
 * Works reliably with drive.file scope because each file was explicitly selected by the user.
 */
export async function importFilesFromGoogleDrive(
  fileIds: string[],
  accessToken: string,
  projectId?: string | null,
  limit: number = MAX_IMPORT_PER_REQUEST
): Promise<ImportFromGoogleDriveResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Sign in to import from Google Drive." };

  const limits = await getPlanLimits(user.id, user.email);
  const currentCount = await countAssets(user.id);
  const remaining = Math.max(0, limits.assets - currentCount);
  if (remaining === 0) {
    return { ok: false, error: `Asset limit reached (${limits.assets}). Delete some assets or upgrade to add more.` };
  }

  const ids = fileIds.slice(0, Math.min(limit, remaining, MAX_IMPORT_PER_REQUEST));
  const created: { id: string; storage_path: string; file_name: string; url: string }[] = [];
  const projectIdTrimmed = projectId && String(projectId).trim() ? String(projectId).trim() : null;

  for (const fileId of ids) {
    const result = await importSingleFileFromGoogleDrive(fileId.trim(), accessToken, projectIdTrimmed);
    if (result.ok) created.push({ id: result.asset.id, storage_path: result.asset.storage_path, file_name: result.asset.file_name, url: result.asset.url });
    if (created.length >= remaining) break;
  }

  if (created.length === 0) {
    return { ok: false, error: "Could not import any images. Files may be over 20MB, not image types, or access was denied. Select JPEG, PNG, WebP, GIF, or HEIC files." };
  }
  return { ok: true, assets: created };
}

export type ImportSingleFileFromGoogleDriveResult =
  | { ok: true; asset: { id: string; storage_path: string; file_name: string; url: string } }
  | { ok: false; error: string };

/**
 * Import one image file from Google Drive by file ID (e.g. from Picker single-file selection).
 */
export async function importSingleFileFromGoogleDrive(
  fileId: string,
  accessToken: string,
  projectId?: string | null
): Promise<ImportSingleFileFromGoogleDriveResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Sign in to import from Google Drive." };

  const trimmedId = fileId?.trim();
  if (!trimmedId) return { ok: false, error: "No file selected." };

  const limits = await getPlanLimits(user.id, user.email);
  const currentCount = await countAssets(user.id);
  if (currentCount >= limits.assets) {
    return { ok: false, error: `Asset limit reached (${limits.assets}). Delete some assets or upgrade to add more.` };
  }

  const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(trimmedId)}?fields=name,mimeType`;
  let metaRes: Response;
  try {
    metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: `Could not get file: ${msg}` };
  }
  if (!metaRes.ok) {
    if (metaRes.status === 401) return { ok: false, error: "Google sign-in expired. Try again." };
    return { ok: false, error: `Google Drive error: ${metaRes.status}` };
  }

  type DriveFileMeta = { name?: string; mimeType?: string };
  const meta = (await metaRes.json()) as DriveFileMeta;
  const mimeType = IMAGE_MIME_TYPES.includes(meta.mimeType ?? "") ? meta.mimeType! : "image/jpeg";
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(trimmedId)}?alt=media`;

  let fileRes: Response;
  try {
    fileRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, error: `Could not download file: ${msg}` };
  }
  if (!fileRes.ok) return { ok: false, error: `Download failed: ${fileRes.status}` };

  let buffer = Buffer.from(await fileRes.arrayBuffer());
  if (buffer.length > MAX_FILE_BYTES) return { ok: false, error: "File must be 20MB or smaller." };
  if (buffer.length === 0) return { ok: false, error: "File is empty." };

  let mimeToProcess = mimeType;
  if (isHeicMime(mimeType)) {
    const jpegBuffer = await convertHeicToJpeg(buffer);
    if (!jpegBuffer) return { ok: false, error: "HEIC conversion is not available. Install the heic-convert package or use a JPEG/PNG file." };
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

  const safeName = (meta.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
  const baseName = safeName.includes(".") ? safeName.replace(/\.[^.]+$/, "") : safeName;
  const fileName = `${baseName}.${processed.extension}`;
  const assetId = crypto.randomUUID();
  const storagePath = `user/${user.id}/assets/${assetId}/${fileName}`;
  const projectIdTrimmed = projectId && String(projectId).trim() ? String(projectId).trim() : null;

  try {
    await createAsset(user.id, {
      project_id: projectIdTrimmed,
      kind: "image",
      file_name: fileName,
      storage_path: storagePath,
      width: null,
      height: null,
      blurhash: null,
    });
    const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.mimeType });
    await uploadUserAsset(user.id, assetId, blob, fileName, processed.mimeType);
    const url = await getSignedImageUrl(BUCKET, storagePath, SIGNED_URL_EXPIRES);
    return { ok: true, asset: { id: assetId, storage_path: storagePath, file_name: fileName, url } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

function getExtensionForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? "jpg";
}
