"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { getSubscription, getPlanLimits } from "@/lib/server/subscription";
import { createAsset, countAssets } from "@/lib/server/db";
import { uploadUserAsset } from "@/lib/server/storage/upload";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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
    return { ok: false, error: "File must be an image (JPEG, PNG, WebP, GIF)" };
  }

  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File must be 8MB or smaller" };
  }

  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "image";
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
    await uploadUserAsset(user.id, assetId, file, fileName, file.type);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, assetId, storagePath };
}
