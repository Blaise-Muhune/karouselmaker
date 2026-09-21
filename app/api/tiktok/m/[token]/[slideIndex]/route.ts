import { NextResponse } from "next/server";
import { getTikTokScheduledPostByMediaToken } from "@/lib/server/db";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { normalizeTikTokPhoto } from "@/lib/server/tiktok/normalizeTikTokPhoto";
import { scheduledPostSlidePath } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";

/**
 * Path-based TikTok media URL (no query string):
 * /api/tiktok/m/{mediaToken}/{slideIndex}
 * Prefer this over the legacy ?token= route — some pull clients mishandle query params.
 */
async function loadSlide(token: string, rawIndex: string) {
  const schedule = await getTikTokScheduledPostByMediaToken(token);
  if (!schedule) return { error: new NextResponse("Not found", { status: 404 }) };
  const path = scheduledPostSlidePath(schedule, Number(rawIndex));
  if (!path) return { error: new NextResponse("Not found", { status: 404 }) };
  const image = await downloadStorageImageBuffer("carousel-assets", path, 15 * 1024 * 1024);
  if (!image) return { error: new NextResponse("Exported slide unavailable", { status: 404 }) };
  try {
    return await normalizeTikTokPhoto(image);
  } catch {
    return { error: new NextResponse("Exported slide is not a valid TikTok image", { status: 422 }) };
  }
}

function imageHeaders(
  bytes: Buffer,
  contentType: "image/jpeg" | "image/webp",
  slideIndex: string
) {
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  return {
    "Content-Type": contentType,
    "Content-Length": String(bytes.byteLength),
    // Avoid Content-Disposition — some pull clients treat attachment oddly.
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
    "X-Content-Type-Options": "nosniff",
    "X-Slide-Index": slideIndex,
    "X-File-Ext": ext,
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string; slideIndex: string }> }
) {
  const { token, slideIndex } = await context.params;
  const loaded = await loadSlide(token, slideIndex);
  if ("error" in loaded && loaded.error) return loaded.error;
  const { bytes, contentType } = loaded as { bytes: Buffer; contentType: "image/jpeg" | "image/webp" };
  return new NextResponse(new Uint8Array(bytes), {
    headers: imageHeaders(bytes, contentType, slideIndex),
  });
}

export async function HEAD(
  _request: Request,
  context: { params: Promise<{ token: string; slideIndex: string }> }
) {
  const { token, slideIndex } = await context.params;
  const loaded = await loadSlide(token, slideIndex);
  if ("error" in loaded && loaded.error) return loaded.error;
  const { bytes, contentType } = loaded as { bytes: Buffer; contentType: "image/jpeg" | "image/webp" };
  return new NextResponse(null, {
    status: 200,
    headers: imageHeaders(bytes, contentType, slideIndex),
  });
}
