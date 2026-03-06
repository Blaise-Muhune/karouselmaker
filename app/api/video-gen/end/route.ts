import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Release the video generation lock for the current user. Call when video generation finishes or fails. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;

  await supabase.rpc("release_video_gen_lock", { p_user_id: userId });
  return new Response(null, { status: 200 });
}
