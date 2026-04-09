/**
 * Load project UGC avatar assets as JPEG buffers for OpenAI images.edit (reference conditioning).
 */

import sharp from "sharp";
import { MAX_UGC_AVATAR_REFERENCE_ASSETS } from "@/lib/constants";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
/** Longest edge for refs — balances identity signal vs token cost (OpenAI edit accepts up to 50MB). */
const MAX_REF_EDGE_PX = 1536;

/**
 * Returns one normalized JPEG per valid asset, in order, capped by MAX_UGC_AVATAR_REFERENCE_ASSETS.
 */
export async function loadUgcAvatarReferenceJpegBuffers(
  userId: string,
  assetIds: string[]
): Promise<Buffer[]> {
  const ids = [...new Set(assetIds.filter(Boolean))].slice(0, MAX_UGC_AVATAR_REFERENCE_ASSETS);
  const out: Buffer[] = [];
  for (const id of ids) {
    const asset = await getAsset(userId, id);
    if (!asset?.storage_path) continue;
    const raw = await downloadStorageImageBuffer(BUCKET, asset.storage_path);
    if (!raw?.length) continue;
    try {
      const jpeg = await sharp(raw)
        .rotate()
        .resize(MAX_REF_EDGE_PX, MAX_REF_EDGE_PX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      if (jpeg.length > 0) out.push(jpeg);
    } catch {
      // skip corrupt / unsupported
    }
  }
  return out;
}
