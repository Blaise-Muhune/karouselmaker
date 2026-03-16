import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/** GET: return a signed URL to download the sound effect file (for video generation). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: row, error: fetchError } = await supabase
    .from("user_sound_effects")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !row?.storage_path) {
    return NextResponse.json({ error: "Sound effect not found" }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("carousel-assets")
    .createSignedUrl(row.storage_path, 300); // 5 min

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not create download URL" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
