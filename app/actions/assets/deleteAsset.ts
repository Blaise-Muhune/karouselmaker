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
