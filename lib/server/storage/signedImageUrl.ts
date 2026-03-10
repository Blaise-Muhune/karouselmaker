import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_EXPIRES = 3600; // 1 hour so preview/display links don't expire too quickly

/**
 * Generate a signed URL for displaying an image (no download disposition).
 * Uses service role so the URL works for the given path regardless of RLS.
 */
export async function getSignedImageUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, { download: false });

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}
