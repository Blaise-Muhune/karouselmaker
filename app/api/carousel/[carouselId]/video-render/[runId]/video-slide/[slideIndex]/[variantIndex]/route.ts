/**
 * Proxy video-slide image for video-render (no export). Same-origin so browser can fetch for video generation.
 * GET /api/carousel/[carouselId]/video-render/[runId]/video-slide/[slideIndex]/[variantIndex]
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel } from "@/lib/server/db";
import { getVideoRenderStoragePaths } from "@/lib/server/db/exports";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "carousel-assets";

export async function GET(
  _request: Request,
  context: { params: Promise<{ carouselId: string; runId: string; slideIndex: string; variantIndex: string }> }
) {
  const { carouselId, runId, slideIndex: slideIndexStr, variantIndex: variantIndexStr } = await context.params;

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

  const slideIndex = parseInt(slideIndexStr, 10);
  const variantIndex = parseInt(variantIndexStr, 10);
  if (Number.isNaN(slideIndex) || Number.isNaN(variantIndex) || slideIndex < 0 || variantIndex < 0) {
    return NextResponse.json({ error: "Invalid slide or variant index" }, { status: 400 });
  }

  const paths = getVideoRenderStoragePaths(userId, carouselId, runId);
  const path = paths.videoSlidePath(slideIndex, variantIndex);

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "File not found" }, { status: 404 });
  }

  const buf = await data.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
