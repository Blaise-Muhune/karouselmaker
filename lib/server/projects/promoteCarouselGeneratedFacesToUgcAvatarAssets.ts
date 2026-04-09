import { MAX_UGC_AVATAR_REFERENCE_ASSETS } from "@/lib/constants";
import { ugcSlideLikelyShowsHostFaceForChainRef } from "@/lib/server/ai/ugcSlideLikelyShowsHostFaceForChainRef";
import type { CarouselOutput } from "@/lib/server/ai/carouselSchema";

type AiSlideRow = CarouselOutput["slides"][number];
import { createAsset, countAssets } from "@/lib/server/db/assets";
import { listSlides } from "@/lib/server/db/slides";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { processImageBuffer } from "@/lib/server/images/processImage";
import { getEffectivePlanLimits } from "@/lib/server/subscription";
import { uploadUserAsset } from "@/lib/server/storage/upload";

const BUCKET = "carousel-assets";

function slideAsAiSlideForHeuristic(s: {
  slide_index: number;
  headline: string;
  body: string | null;
}): AiSlideRow {
  return {
    slide_index: s.slide_index,
    slide_type: "hook",
    headline: s.headline,
    body: s.body ?? "",
    image_queries: [],
  };
}

function generatedBgPathForCarousel(path: string, userId: string, carouselId: string): boolean {
  const p = path.replace(/^\/+/, "").trim();
  return (
    p.startsWith(`user/${userId}/`) &&
    p.includes(`/generated/${carouselId}/`) &&
    /\.(jpe?g|png|webp)$/i.test(p)
  );
}

/**
 * Copies a few AI-generated slide backgrounds from a carousel into new library assets
 * and returns their IDs (for `projects.ugc_character_avatar_asset_ids`).
 */
export async function promoteCarouselGeneratedFacesToUgcAvatarAssets(params: {
  userId: string;
  userEmail: string | null | undefined;
  projectId: string;
  carouselId: string;
}): Promise<{ ok: true; assetIds: string[] } | { ok: false; error: string }> {
  const { userId, userEmail, projectId, carouselId } = params;
  const limits = await getEffectivePlanLimits(userId, userEmail ?? null);
  const ugcCap = Math.min(MAX_UGC_AVATAR_REFERENCE_ASSETS, limits.maxUgcAvatarReferenceAssets);
  let assetSlots = Math.max(0, limits.assets - (await countAssets(userId)));
  if (assetSlots <= 0) {
    return {
      ok: false,
      error: `Library is full (${limits.assets} images). Remove some assets or upgrade, then try again.`,
    };
  }

  const slides = await listSlides(userId, carouselId);
  const withGeneratedPath = slides
    .map((s) => {
      const bg = s.background as { mode?: string; storage_path?: string } | null;
      const path = bg?.storage_path?.trim() ?? "";
      if (bg?.mode !== "image" || !path || !generatedBgPathForCarousel(path, userId, carouselId)) return null;
      return { slide: s, path };
    })
    .filter((x): x is { slide: (typeof slides)[number]; path: string } => x != null)
    .sort((a, b) => a.slide.slide_index - b.slide.slide_index);

  if (withGeneratedPath.length === 0) {
    return {
      ok: false,
      error: "No AI-generated slide images found on this carousel to save as face references.",
    };
  }

  const faceLikely = withGeneratedPath.filter((x) =>
    ugcSlideLikelyShowsHostFaceForChainRef(slideAsAiSlideForHeuristic(x.slide))
  );
  const ordered = faceLikely.length > 0 ? faceLikely : withGeneratedPath;

  const assetIds: string[] = [];
  for (const { path } of ordered) {
    if (assetIds.length >= ugcCap) break;
    if (assetSlots <= 0) break;

    const buf = await downloadStorageImageBuffer(BUCKET, path);
    if (!buf) continue;

    let processed: Awaited<ReturnType<typeof processImageBuffer>>;
    try {
      processed = await processImageBuffer(buf, "image/jpeg");
    } catch {
      continue;
    }

    const assetId = crypto.randomUUID();
    const fileName = `ugc-face-${carouselId.slice(0, 8)}-${assetIds.length + 1}.${processed.extension}`;
    const storagePath = `user/${userId}/assets/${assetId}/${fileName}`;

    try {
      await createAsset(userId, {
        project_id: projectId,
        kind: "image",
        file_name: fileName,
        storage_path: storagePath,
        width: null,
        height: null,
        blurhash: null,
      });
      const blob = new Blob([new Uint8Array(processed.buffer)], { type: processed.mimeType });
      await uploadUserAsset(userId, assetId, blob, fileName, processed.mimeType);
      assetIds.push(assetId);
      assetSlots -= 1;
    } catch {
      // Row may exist without file — rare; skip this frame
    }
  }

  if (assetIds.length === 0) {
    return {
      ok: false,
      error: "Could not copy slide images into your library (processing or upload failed). Try again.",
    };
  }

  return { ok: true, assetIds };
}
