/**
 * Pexels API: search for photos. Requires PEXELS_API_KEY.
 * Attribution: credit photographer and link to Pexels when displaying results.
 */

const PEXELS_SEARCH = "https://api.pexels.com/v1/search";
const FETCH_TIMEOUT_MS = 15000;
const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";
const isDev = process.env.NODE_ENV === "development";

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, next: { revalidate: 0 } });
  } finally {
    clearTimeout(t);
  }
}

export type PexelsAttribution = {
  photographer: string;
  photographer_url: string;
  photo_url: string;
};

export type PexelsPhotoResult = {
  url: string;
  attribution?: PexelsAttribution;
};

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  src?: { original?: string; large?: string; large2x?: string; medium?: string };
};

export function isPexelsConfigured(): boolean {
  return !!process.env.PEXELS_API_KEY?.trim();
}

/**
 * Search Pexels for photos; returns up to perPage results. Uses large or original size.
 */
export async function searchPexelsPhotos(
  query: string,
  perPage = 15,
  page = 1
): Promise<PexelsPhotoResult[]> {
  const key = process.env.PEXELS_API_KEY?.trim();
  if (!key || !query.trim()) {
    if (DEBUG || isDev) console.log("[pexels] skip: missing PEXELS_API_KEY or query");
    return [];
  }

  if (DEBUG || isDev) console.log("[pexels] Query:", query.trim());

  const params = new URLSearchParams({
    query: query.trim().slice(0, 200),
    orientation: "portrait",
    per_page: String(Math.min(80, Math.max(1, perPage))),
    page: String(Math.max(1, page)),
  });

  try {
    const res = await fetchWithTimeout(`${PEXELS_SEARCH}?${params.toString()}`, {
      headers: { Authorization: key },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (DEBUG || isDev) console.log("[pexels] HTTP", res.status, body || "");
      return [];
    }
    const data = (await res.json()) as { photos?: PexelsPhoto[] };
    const photos = data.photos ?? [];
    const results = photos.map((photo) => {
      const imageUrl = photo.src?.large ?? photo.src?.large2x ?? photo.src?.original ?? "";
      const attribution: PexelsAttribution | undefined = {
        photographer: photo.photographer,
        photographer_url: photo.photographer_url,
        photo_url: photo.url,
      };
      return { url: imageUrl, attribution };
    }).filter((r) => r.url);
    if (DEBUG || isDev) {
      if (results.length > 0) {
        console.log("[pexels] Result:", results.length, "photos, first:", results[0]!.url.slice(0, 60) + "...");
      } else {
        console.log("[pexels] Result: no photos");
      }
      console.log("");
    }
    return results;
  } catch (err) {
    if (DEBUG || isDev) console.log("[pexels] fetch error:", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Pick one random result from a search (for single-image use). */
export async function searchPexelsPhotoRandom(query: string): Promise<PexelsPhotoResult | null> {
  const results = await searchPexelsPhotos(query, 20);
  if (results.length === 0) return null;
  return results[Math.floor(Math.random() * results.length)] ?? null;
}
