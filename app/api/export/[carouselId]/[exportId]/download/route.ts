import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel } from "@/lib/server/db";
import { getExport, getExportStoragePaths } from "@/lib/server/db/exports";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { slugifyForFilename } from "@/lib/utils";

const BUCKET = "carousel-assets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Streams a previously-rendered export through a normal attachment response.
 * This avoids mobile browsers dropping a large in-memory Blob download after a
 * long render request has completed.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ carouselId: string; exportId: string }> }
) {
  const { carouselId, exportId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [carousel, exported] = await Promise.all([
    getCarousel(user.id, carouselId),
    getExport(user.id, exportId),
  ]);
  if (!carousel || !exported || exported.carousel_id !== carouselId) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }
  if (exported.status !== "ready" || !exported.storage_path) {
    return NextResponse.json({ error: "This export is no longer available. Please create it again." }, { status: 404 });
  }

  const paths = getExportStoragePaths(user.id, carouselId, exportId);
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET)
    .list(paths.slidesDir, { limit: 100 });
  if (listError) {
    return NextResponse.json({ error: "Could not prepare the export download." }, { status: 500 });
  }

  const slideFiles = (files ?? [])
    .filter((file) => /^\d+\.png$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (slideFiles.length === 0) {
    return NextResponse.json({ error: "This export has no slide files." }, { status: 404 });
  }

  const zip = new JSZip();
  const extension = exported.format === "jpeg" ? "jpg" : "png";
  for (const file of slideFiles) {
    const image = await downloadStorageImageBuffer(BUCKET, `${paths.slidesDir}/${file.name}`, 20 * 1024 * 1024);
    if (!image) {
      return NextResponse.json({ error: "One of the slide files could not be read. Please create the export again." }, { status: 500 });
    }
    zip.file(file.name.replace(/\.png$/i, `.${extension}`), image);
  }

  const filename = `${slugifyForFilename(carousel.title) || "carousel"}.zip`;
  const archive = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
