import { NextResponse } from "next/server";
import { getTikTokScheduledPostForMedia } from "@/lib/server/db";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { normalizeTikTokPhoto } from "@/lib/server/tiktok/normalizeTikTokPhoto";
import { scheduledPostSlidePath } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";

/** Legacy query-token route. Prefer /api/tiktok/m/{token}/{slideIndex}. */
async function loadScheduledSlide(
  request: Request,
  context: { params: Promise<{ scheduleId: string; slideIndex: string }> }
) {
  const { scheduleId, slideIndex: rawIndex } = await context.params;
  const mediaToken = new URL(request.url).searchParams.get("token") ?? "";
  const schedule = await getTikTokScheduledPostForMedia(scheduleId, mediaToken);
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

export async function GET(
  request: Request,
  context: { params: Promise<{ scheduleId: string; slideIndex: string }> }
) {
  const loaded = await loadScheduledSlide(request, context);
  if ("error" in loaded && loaded.error) return loaded.error;
  const { bytes, contentType } = loaded as { bytes: Buffer; contentType: "image/jpeg" | "image/webp" };
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ scheduleId: string; slideIndex: string }> }
) {
  const loaded = await loadScheduledSlide(request, context);
  if ("error" in loaded && loaded.error) return loaded.error;
  const { bytes, contentType } = loaded as { bytes: Buffer; contentType: "image/jpeg" | "image/webp" };
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
