import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExport, getExportStoragePaths } from "@/lib/server/db/exports";

const BUCKET = "carousel-assets";

/**
 * Proxy video-slide image so the browser can fetch it same-origin (avoids 400/CORS with direct storage signed URLs).
 * GET /api/export/[carouselId]/[exportId]/video-slide/[slideIndex]/[variantIndex]
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ carouselId: string; exportId: string; slideIndex: string; variantIndex: string }> }
) {
  const { carouselId, exportId, slideIndex: slideIndexStr, variantIndex: variantIndexStr } = await context.params;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const exportRow = await getExport(userId, exportId);
  if (!exportRow || exportRow.carousel_id !== carouselId) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const slideIndex = parseInt(slideIndexStr, 10);
  const variantIndex = parseInt(variantIndexStr, 10);
  if (Number.isNaN(slideIndex) || Number.isNaN(variantIndex) || slideIndex < 0 || variantIndex < 0) {
    return NextResponse.json({ error: "Invalid slide or variant index" }, { status: 400 });
  }

  const paths = getExportStoragePaths(userId, carouselId, exportId);
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
