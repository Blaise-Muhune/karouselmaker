"use server";

import { getUser } from "@/lib/server/auth/getUser";
import { listAssets } from "@/lib/server/db";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";
import type { Asset } from "@/lib/server/db/types";

const BUCKET = "carousel-assets";
const URL_EXPIRES = 600;
const ASSET_PICKER_LIMIT = 200;

export type ListAssetsWithUrlsResult =
  | { ok: true; assets: Asset[]; urls: Record<string, string> }
  | { ok: false; error: string };

/** Lists images in the user's library with signed URLs. Omit `projectId` to match /assets (all library). */
export async function listAssetsWithUrls(options?: {
  projectId?: string | null;
}): Promise<ListAssetsWithUrlsResult> {
  const { user } = await getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const assets = await listAssets(user.id, {
    limit: ASSET_PICKER_LIMIT,
    ...(options && "projectId" in options ? { projectId: options.projectId } : {}),
  });

  const urls: Record<string, string> = {};
  await Promise.all(
    assets.map(async (a) => {
      try {
        urls[a.id] = await getSignedImageUrl(BUCKET, a.storage_path, URL_EXPIRES);
      } catch {
        // skip
      }
    })
  );

  return { ok: true, assets, urls };
}
