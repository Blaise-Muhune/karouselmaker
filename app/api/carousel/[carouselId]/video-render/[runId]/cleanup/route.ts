/**
 * Delete video-render assets for this run after the client has finished generating the video.
 * Keeps storage clean; no need to persist slide images once the user has the MP4.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCarousel } from "@/lib/server/db";

const BUCKET = "carousel-assets";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ carouselId: string; runId: string }> }
) {
  const { carouselId, runId } = await context.params;
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

  const runPrefix = `user/${userId}/video-renders/${carouselId}/${runId}`;

  try {
    const { data: dirs } = await supabase.storage.from(BUCKET).list(runPrefix);
    const toRemove: string[] = [];
    for (const d of dirs ?? []) {
      if (!d.name) continue;
      const subPath = `${runPrefix}/${d.name}`;
      const { data: files } = await supabase.storage.from(BUCKET).list(subPath);
      for (const f of files ?? []) {
        if (f.name) toRemove.push(`${subPath}/${f.name}`);
      }
    }
    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove);
    }
    return new Response(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}
