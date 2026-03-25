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

/**
 * Use for server-built preview `<img src>` when a fresh signed URL from `storage_path` is unavailable.
 * Allows any https URL, including Supabase signed URLs already stored on the slide (export HTML does the same).
 */
export function httpsDisplayImageUrl(url: string | null | undefined): string | undefined {
  if (url == null || typeof url !== "string") return undefined;
  const t = url.trim();
  if (!/^https?:\/\//i.test(t)) return undefined;
  return t;
}
