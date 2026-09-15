import { NextResponse } from "next/server";
import sharp from "sharp";
import { getTikTokScheduledPostForMedia } from "@/lib/server/db";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { scheduledPostSlidePath } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";

function imageContentType(bytes: Buffer): "image/jpeg" | "image/webp" | "image/png" | null {
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
  if (isPng(bytes)) return "image/png";
  return null;
}

function isPng(bytes: Buffer): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/** TikTok Photo Mode only accepts JPEG and WebP. Older scheduled exports may be PNG. */
async function normalizeTikTokPhoto(image: Buffer): Promise<{ bytes: Buffer; contentType: "image/jpeg" | "image/webp" }> {
  const contentType = imageContentType(image);
  if (contentType === "image/jpeg" || contentType === "image/webp") {
    return { bytes: image, contentType };
  }
  if (contentType !== "image/png") throw new Error("Scheduled export is not a supported image.");
  const bytes = await sharp(image, { failOnError: true }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  return { bytes, contentType: "image/jpeg" };
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
      "Content-Disposition": `inline; filename="slide-${String((await context.params).slideIndex).padStart(2, "0")}.${contentType === "image/webp" ? "webp" : "jpg"}"`,
      // TikTok pulls multiple images at once. Let the CDN serve the immutable schedule
      // URL directly instead of making every photo wait for a storage download.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
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
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
