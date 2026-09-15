import { NextResponse } from "next/server";
import { getTikTokScheduledPostForMedia } from "@/lib/server/db";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { scheduledPostSlidePath } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";

function imageContentType(bytes: Buffer): string {
  // TikTok Photo Mode accepts JPEG and WebP only.
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return "image/jpeg";
}

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
  return { image, contentType: imageContentType(image) };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ scheduleId: string; slideIndex: string }> }
) {
  const loaded = await loadScheduledSlide(request, context);
  if ("error" in loaded && loaded.error) return loaded.error;
  const { image, contentType } = loaded as { image: Buffer; contentType: string };
  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, immutable",
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
  const { image, contentType } = loaded as { image: Buffer; contentType: string };
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(image.byteLength),
      "Cache-Control": "public, max-age=300, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
