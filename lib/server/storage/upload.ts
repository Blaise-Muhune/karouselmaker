import { createClient } from "@/lib/supabase/server";

const BUCKET = "carousel-assets";

/**
 * Upload a file to user's asset path: user/{userId}/assets/{assetId}/{fileName}
 * Caller must have created the asset row (or will create after) with the same storage_path.
 * Uses session client so RLS allows insert to user/{auth.uid()}/...
 */
export async function uploadUserAsset(
  userId: string,
  assetId: string,
  file: File | Blob,
  fileName: string,
  contentType: string
): Promise<{ path: string }> {
  const supabase = await createClient();
  const path = `user/${userId}/assets/${assetId}/${encodeURIComponent(fileName)}`;
  const buffer = await (file as Blob).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(error.message);
  return { path };
}
