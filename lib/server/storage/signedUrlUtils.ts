/**
 * Returns true if the URL is a Supabase storage signed URL.
 * Signed URLs expire (JWT exp claim); they must not be persisted to the DB.
 */
export function isSupabaseSignedUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("supabase.co") &&
    url.includes("/storage/") &&
    url.includes("/sign/")
  );
}
