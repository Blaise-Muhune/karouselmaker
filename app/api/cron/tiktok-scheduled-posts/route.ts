import { NextResponse } from "next/server";
import { claimDueTikTokScheduledPosts } from "@/lib/server/db";
import { publishScheduledTikTokPost } from "@/lib/server/tiktok/scheduledPosts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const due = await claimDueTikTokScheduledPosts(5);
  await Promise.all(due.map((schedule) => publishScheduledTikTokPost(schedule)));
  return NextResponse.json({ claimed: due.length });
}
