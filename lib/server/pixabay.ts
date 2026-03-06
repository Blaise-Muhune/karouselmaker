/**
 * Pixabay API: search for photos. Requires PIXABAY_API_KEY.
 * Images are under Pixabay Content License (free for commercial/non-commercial; attribution requested).
 * API asks to show users where images are from when displaying results.
 */

const PIXABAY_API = "https://pixabay.com/api/";
const FETCH_TIMEOUT_MS = 15000;
const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";
const isDev = process.env.NODE_ENV === "development";

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, next: { revalidate: 0 } });
  } finally {
    clearTimeout(t);
  }
}

export type PixabayAttribution = {
  userName: string;
  userId: number;
  pageURL: string;
  photoURL: string;
};

export type PixabayPhotoResult = {
  url: string;
  attribution?: PixabayAttribution;
};

type PixabayHit = {
  id: number;
  largeImageURL?: string;
  webformatURL?: string;
  pageURL?: string;
  user?: string;
  user_id?: number;
};

export function isPixabayConfigured(): boolean {
  return !!process.env.PIXABAY_API_KEY?.trim();
}

/**
 * Search Pixabay for photos; returns up to perPage results. Uses largeImageURL (1280px) when available.
 * @param order - "popular" (default) or "latest"; use "latest" occasionally for different result sets and variety.
 */
export async function searchPixabayPhotos(
  query: string,
  perPage = 15,
  page = 1,
  order: "popular" | "latest" = "popular"
): Promise<PixabayPhotoResult[]> {
  const key = process.env.PIXABAY_API_KEY?.trim();
  if (!key || !query.trim()) {
    if (DEBUG || isDev) console.log("[pixabay] skip: missing PIXABAY_API_KEY or query");
    return [];
  }

  if (DEBUG || isDev) console.log("[pixabay] Query:", query.trim(), "order:", order);

  const params = new URLSearchParams({
    key,
    q: query.trim().slice(0, 100),
    image_type: "photo",
    orientation: "vertical",
    safesearch: "true",
    order,
    per_page: String(Math.min(200, Math.max(3, perPage))),
    page: String(Math.max(1, page)),
  });

  try {
    const res = await fetchWithTimeout(`${PIXABAY_API}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (DEBUG || isDev) console.log("[pixabay] HTTP", res.status, body || "");
      return [];
    }
    const data = (await res.json()) as { hits?: PixabayHit[]; total?: number };
    const hits = data.hits ?? [];
    const results = hits.map((hit) => {
      const imageUrl = hit.largeImageURL ?? hit.webformatURL ?? "";
      const pageURL = hit.pageURL ?? `https://pixabay.com/photos/-${hit.id}/`;
      const attribution: PixabayAttribution | undefined =
        hit.user != null
          ? {
              userName: hit.user,
              userId: hit.user_id ?? 0,
              pageURL: `https://pixabay.com/users/${hit.user}-${hit.user_id ?? 0}/`,
              photoURL: pageURL,
            }
          : undefined;
      return { url: imageUrl, attribution };
    }).filter((r) => r.url);
    if (DEBUG || isDev) {
      if (results.length > 0) {
        console.log("[pixabay] Result:", results.length, "hits, first:", results[0]!.url.slice(0, 60) + "...");
      } else {
        console.log("[pixabay] Result: no hits");
      }
      console.log("");
    }
    return results;
  } catch (err) {
    if (DEBUG || isDev) console.log("[pixabay] fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Pick one random result from a search (for single-image use). */
export async function searchPixabayPhotoRandom(query: string): Promise<PixabayPhotoResult | null> {
  const results = await searchPixabayPhotos(query, 20);
  if (results.length === 0) return null;
  return results[Math.floor(Math.random() * results.length)] ?? null;
}
