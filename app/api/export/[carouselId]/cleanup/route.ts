/**
 * Delete stored export files (slide images) for an export.
 * Called when user navigates away or after a delay so storage is not kept indefinitely.
 * Post to FB/IG will require re-export after cleanup.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExport, updateExport } from "@/lib/server/db/exports";

const BUCKET = "carousel-assets";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  let body: { exportId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const exportId = body.exportId;
  if (!exportId || typeof exportId !== "string") {
    return NextResponse.json({ error: "exportId required" }, { status: 400 });
  }

  const exportRow = await getExport(userId, exportId);
  if (!exportRow || exportRow.carousel_id !== carouselId) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const prefix = `user/${userId}/exports/${carouselId}/${exportId}`;

  try {
    const { data: topDirs } = await supabase.storage.from(BUCKET).list(prefix);
    const toRemove: string[] = [];
    for (const d of topDirs ?? []) {
      if (!d.name) continue;
      const subPath = `${prefix}/${d.name}`;
      const { data: files } = await supabase.storage.from(BUCKET).list(subPath);
      for (const f of files ?? []) {
        if (f.name) toRemove.push(`${subPath}/${f.name}`);
      }
    }
    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove);
    }
    await updateExport(userId, exportId, { status: exportRow.status, storage_path: null });
    return new Response(null, { status: 204 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cleanup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
