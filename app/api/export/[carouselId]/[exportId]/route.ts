import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExport, getExportStoragePaths, listSlides } from "@/lib/server/db";
import { getSignedDownloadUrl } from "@/lib/server/storage/signedUrl";
import { getSignedImageUrl } from "@/lib/server/storage/signedImageUrl";

const BUCKET = "carousel-assets";

export const dynamic = "force-dynamic";

/** Poll this from the client when export is pending (async/mobile flow). */
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

  const row = await getExport(userId, exportId);
  if (!row || row.carousel_id !== carouselId) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const out: { status: string; downloadUrl?: string; slideUrls?: string[] } = {
    status: row.status,
  };

  if (row.status === "ready" && row.storage_path) {
    out.downloadUrl = await getSignedDownloadUrl(BUCKET, row.storage_path, 600);
    const paths = getExportStoragePaths(userId, carouselId, exportId);
    const slides = await listSlides(userId, carouselId);
    out.slideUrls = await Promise.all(
      slides.map((_, i) => getSignedImageUrl(BUCKET, paths.slidePath(i), 600))
    );
  }

  return NextResponse.json(out);
}
