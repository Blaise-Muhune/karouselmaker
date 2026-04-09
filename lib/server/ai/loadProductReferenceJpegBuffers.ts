/**
 * Load product / app / service reference assets as JPEG buffers for OpenAI images.edit (image-to-image).
 */

import sharp from "sharp";
import { MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS } from "@/lib/constants";
import { getAsset } from "@/lib/server/db/assets";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";

const BUCKET = "carousel-assets";
const MAX_REF_EDGE_PX = 1536;

export async function loadProductReferenceJpegBuffers(
  userId: string,
  assetIds: string[]
): Promise<Buffer[]> {
  const ids = [...new Set(assetIds.filter(Boolean))].slice(0, MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS);
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
