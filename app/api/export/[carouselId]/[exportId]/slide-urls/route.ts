import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel, listSlides } from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";
const SIGNED_URL_EXPIRES = 600;

/**
 * Video uses pre-rendered full-slide screenshots (one per image variant) so every frame is the same as the main.
 * We list video-slides/ and return signed URLs for each slide's variants; no overlay (each URL is already composited).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ carouselId: string; exportId: string }> }
) {
  const { carouselId, exportId } = await context.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const carousel = await getCarousel(userId, carouselId);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  const slides = await listSlides(userId, carouselId);
  if (slides.length === 0) {
    return NextResponse.json({ slideUrls: [], slideVideoData: [] });
  }

  const paths = getExportStoragePaths(userId, carouselId, exportId);
  const slideUrls = await Promise.all(
    slides.map((_, i) =>
      getSignedImageUrl(BUCKET, paths.slidePath(i), SIGNED_URL_EXPIRES)
    )
  );

  const videoSlidesFolder = paths.videoSlidesPrefix.replace(/\/$/, "");
  const { data: videoSlideFiles } = await supabase.storage
    .from(BUCKET)
    .list(videoSlidesFolder, { limit: 500 });

  const bySlide = new Map<number, number[]>();
  for (const entry of videoSlideFiles ?? []) {
    const name = entry.name ?? "";
    const m = name.match(/^(\d+)-(\d+)\.png$/);
    if (m) {
      const slideIdx = parseInt(m[1]!, 10);
      const variantIdx = parseInt(m[2]!, 10);
      const list = bySlide.get(slideIdx) ?? [];
      list.push(variantIdx);
      bySlide.set(slideIdx, list);
    }
  }
  for (const list of bySlide.values()) {
    list.sort((a, b) => a - b);
  }

  // Use same-origin proxy URLs for video slide images so the browser can fetch without 400/CORS from storage.
  const slideVideoDataResolved = slides.map((_, i) => {
    const variantIndices = bySlide.get(i) ?? [];
    const backgroundUrls =
      variantIndices.length > 0
        ? variantIndices.map((v) => `/api/export/${carouselId}/${exportId}/video-slide/${i}/${v}`)
        : [slideUrls[i]!];
    return {
      backgroundUrls,
      overlayUrl: null as string | null,
    };
  });

  return NextResponse.json({
    slideUrls,
    slideVideoData: slideVideoDataResolved,
  });
}
