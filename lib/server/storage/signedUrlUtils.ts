/**
 * Returns true if the URL is a signed URL for our file storage (Supabase or Azure Blob SAS).
 * Signed URLs expire; they must not be persisted to the DB.
 */
export function isStorageSignedUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const isSupabase = url.includes("supabase.co") && url.includes("/storage/") && url.includes("/sign/");
  const isAzureSas = url.includes(".blob.core.windows.net/") && /[?&]sig=/.test(url);
  return isSupabase || isAzureSas;
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
