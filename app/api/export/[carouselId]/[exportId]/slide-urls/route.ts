import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel, listSlides } from "@/lib/server/db";
import { getExportStoragePaths } from "@/lib/server/db/exports";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";

export const dynamic = "force-dynamic";

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
    return NextResponse.json({ slideUrls: [] });
  }

  const paths = getExportStoragePaths(userId, carouselId, exportId);
  const slideUrls = await Promise.all(
    slides.map((_, i) => getSignedImageUrl(BUCKET, paths.slidePath(i), 600))
  );

  return NextResponse.json({ slideUrls });
}
