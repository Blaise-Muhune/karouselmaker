"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { getAsset } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";

export type GetSignedImageUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Return a signed image URL for an asset. Enforces ownership via getAsset.
 */
export async function getSignedImageUrlForAsset(
  assetId: string,
  expiresInSeconds: number = 600
): Promise<GetSignedImageUrlResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const asset = await getAsset(user.id, assetId);
  if (!asset) return { ok: false, error: "Asset not found" };

  try {
    const url = await getSignedImageUrl(BUCKET, asset.storage_path, expiresInSeconds);
    return { ok: true, url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to get URL";
    return { ok: false, error: msg };
  }
}
