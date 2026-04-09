"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/server/auth/getUser";
import { deleteAsset as dbDeleteAsset, getAsset } from "@/lib/server/db";
import { createAdminClient } from "@/lib/supabase/admin";

export type DeleteAssetResult = { ok: true } | { ok: false; error: string };

export async function deleteAssetAction(
  assetId: string,
  revalidatePathname?: string
): Promise<DeleteAssetResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    const asset = await getAsset(user.id, assetId);
    if (!asset) return { ok: false, error: "Asset not found" };
    await dbDeleteAsset(user.id, assetId);
    const supabase = createAdminClient();
    await supabase.storage.from("carousel-assets").remove([asset.storage_path]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true };
}

const MAX_DELETE_BATCH = 100;

export type DeleteAssetsResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/** Delete many library assets (DB row + storage object) in one request. */
export async function deleteAssetsAction(
  assetIds: string[],
  revalidatePathname?: string
): Promise<DeleteAssetsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const ids = [...new Set(assetIds.map((id) => id?.trim()).filter(Boolean))].slice(0, MAX_DELETE_BATCH);
  if (ids.length === 0) return { ok: false, error: "No assets selected" };

  const supabase = createAdminClient();
  let deleted = 0;
  let firstError: string | null = null;

  for (const id of ids) {
    try {
      const asset = await getAsset(user.id, id);
      if (!asset) {
        if (!firstError) firstError = "One or more assets were not found";
        continue;
      }
      await dbDeleteAsset(user.id, id);
      await supabase.storage.from("carousel-assets").remove([asset.storage_path]);
      deleted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      if (!firstError) firstError = msg;
    }
  }

  if (deleted === 0) {
    return { ok: false, error: firstError ?? "Could not delete assets" };
  }

  if (revalidatePathname) revalidatePath(revalidatePathname);
  return { ok: true, deleted };
}
