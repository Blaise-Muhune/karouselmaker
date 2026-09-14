import { NextResponse } from "next/server";
import { getTikTokScheduledPostForMedia } from "@/lib/server/db";
import { downloadStorageImageBuffer } from "@/lib/server/export/fetchImageAsDataUrl";
import { scheduledPostSlidePath } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ scheduleId: string; slideIndex: string }> }
) {
  const { scheduleId, slideIndex: rawIndex } = await context.params;
  const mediaToken = new URL(request.url).searchParams.get("token") ?? "";
  const schedule = await getTikTokScheduledPostForMedia(scheduleId, mediaToken);
  if (!schedule) return new NextResponse("Not found", { status: 404 });
  const path = scheduledPostSlidePath(schedule, Number(rawIndex));
  if (!path) return new NextResponse("Not found", { status: 404 });
  const image = await downloadStorageImageBuffer("carousel-assets", path, 15 * 1024 * 1024);
  if (!image) return new NextResponse("Exported slide unavailable", { status: 404 });
  return new NextResponse(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
