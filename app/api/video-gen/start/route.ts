import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Acquire the "one video generation at a time" lock for the current user. Returns 200 if acquired, 429 if another tab/session is already generating. */
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

  const { data: acquired, error } = await supabase.rpc("acquire_video_gen_lock", {
    p_user_id: userId,
  });

  if (error) {
    const isMissingFunction =
      error.message?.includes("acquire_video_gen_lock") &&
      (error.message?.includes("does not exist") || error.message?.includes("could not find"));
    if (isMissingFunction) {
      return new Response(null, { status: 200 });
    }
    const message =
      process.env.NODE_ENV === "development"
        ? error.message
        : "Failed to acquire lock";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
  if (!acquired) {
    return NextResponse.json(
      {
        error:
          "Another video is being generated (e.g. in another tab). Please wait for it to finish, then try again.",
      },
      { status: 429 }
    );
  }
  return new Response(null, { status: 200 });
}
