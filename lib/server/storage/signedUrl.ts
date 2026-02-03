import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_EXPIRES = 600; // 10 minutes

/**
 * Generate a signed download URL for a private storage object.
 * Uses service role so the URL works for the given path regardless of RLS.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  path: string,
  expiresInSeconds: number = DEFAULT_EXPIRES
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, { download: true });

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}
