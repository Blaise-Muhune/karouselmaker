import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const BUCKET = "carousel-assets";
const MAX_DURATION_SEC = 7;
const MAX_FILE_BYTES = 6 * 1024 * 1024; // ~6MB (7s WAV stereo 44.1kHz is ~1.2MB)
const ALLOWED_TYPES = [
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
  "application/octet-stream",
];

/** GET: list current user's sound effects. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_sound_effects")
    .select("id, name, storage_path, duration_sec, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

/** POST: upload a sound effect (audio file, or audio extracted from video on client). Max 7s, saved to DB. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const role = formData.get("role") as string | null;
  const durationSecStr = formData.get("duration_sec") as string | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (role !== "intro" && role !== "transition") {
    return NextResponse.json({ error: "role must be intro or transition" }, { status: 400 });
  }

  const durationSec = durationSecStr != null ? parseFloat(durationSecStr) : NaN;
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_DURATION_SEC) {
    return NextResponse.json(
      { error: `duration_sec must be between 0 and ${MAX_DURATION_SEC} seconds` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const type = file.type?.toLowerCase() ?? "";
  const allowed =
    ALLOWED_TYPES.some((t) => type === t) ||
    type.startsWith("audio/");
  if (!allowed) {
    return NextResponse.json(
      { error: "File must be audio (e.g. WAV, MP3). For video, extract audio in the app first." },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const ext = type.includes("mpeg") || type.includes("mp3") ? "mp3" : "wav";
  const storagePath = `user/${user.id}/sound-effects/${id}.${ext}`;

  const buf = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: type || "audio/wav",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabase
    .from("user_sound_effects")
    .insert({
      id,
      user_id: user.id,
      name: name.trim().slice(0, 200),
      storage_path: storagePath,
      duration_sec: durationSec,
      role,
    })
    .select("id, name, storage_path, duration_sec, role, created_at")
    .single();

  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(row);
}
