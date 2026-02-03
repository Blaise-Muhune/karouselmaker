/**
 * Unsplash API: search for a photo and return the first result's display URL.
 * Requires UNSPLASH_ACCESS_KEY. Returns null if key missing or no results.
 */

const UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";

export async function searchUnsplashPhoto(
  query: string
): Promise<{ url: string; downloadLocation?: string } | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query.trim()) {
    if (DEBUG) console.log("[unsplash] skip: missing UNSPLASH_ACCESS_KEY or query");
    return null;
  }

  const params = new URLSearchParams({
    query: query.trim().slice(0, 80),
    per_page: "1",
    orientation: "portrait", // vertical/squarish for carousel slides
  });

  const url = `${UNSPLASH_SEARCH}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (DEBUG) console.log("[unsplash] HTTP", res.status, res.statusText, await res.text().catch(() => ""));
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{
      urls?: { regular?: string; full?: string };
      links?: { download_location?: string };
    }>;
    errors?: string[];
  };

  if (data.errors?.length) {
    if (DEBUG) console.log("[unsplash] API errors:", data.errors);
    return null;
  }

  const first = data.results?.[0];
  const imageUrl = first?.urls?.full ?? first?.urls?.regular;
  if (!imageUrl) {
    if (DEBUG) console.log("[unsplash] no results");
    return null;
  }

  return {
    url: imageUrl,
    downloadLocation: first?.links?.download_location,
  };
}
