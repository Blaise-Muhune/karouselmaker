/**
 * Google Custom Search JSON API for image search.
 * Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID (Programmable Search Engine).
 *
 * Setup: https://developers.google.com/custom-search/v1/overview
 * - Create Programmable Search Engine at programmablesearchengine.google.com
 * - Enable "Search the entire web" and "Image search"
 * - Enable Custom Search API in Google Cloud Console
 * - Get API key and Search engine ID (cx)
 *
 * Note: API is closed to new customers as of 2024; existing users until Jan 2027.
 */

const GOOGLE_CSE_URL = "https://customsearch.googleapis.com/customsearch/v1";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";

/** Best quality: huge > xlarge > xxlarge > large. Use huge for 1080×1080 slides. */
const IMG_SIZE = "huge";
const IMG_TYPE = "photo";
const SAFE = "active";

export async function searchGoogleImage(
  query: string
): Promise<{ url: string } | null> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cx || !query.trim()) {
    if (DEBUG) console.log("[googleImageSearch] skip: missing API key, cx, or query");
    return null;
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query.trim().slice(0, 80),
    searchType: "image",
    imgSize: IMG_SIZE,
    imgType: IMG_TYPE,
    safe: SAFE,
    num: "1",
    hl: "en",
  });

  const url = `${GOOGLE_CSE_URL}?${params.toString()}`;
  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    if (DEBUG) console.log("[googleImageSearch] HTTP", res.status, res.statusText, await res.text().catch(() => ""));
    return null;
  }

  const data = (await res.json()) as {
    items?: Array<{
      link?: string;
      image?: { contextLink?: string; thumbnailLink?: string; width?: number; height?: number };
    }>;
    error?: { code?: number; message?: string };
  };

  if (data.error) {
    if (DEBUG) console.log("[googleImageSearch] API error:", data.error.code, data.error.message);
    return null;
  }

  const first = data.items?.[0];
  if (!first) {
    if (DEBUG) console.log("[googleImageSearch] no items in response");
    return null;
  }

  // link = direct image URL for image search results
  const imageUrl = first.link ?? first.image?.contextLink;
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    if (DEBUG) console.log("[googleImageSearch] no valid image URL in first item");
    return null;
  }

  return { url: imageUrl };
}

export function isGoogleImageSearchConfigured(): boolean {
  return !!(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_ID);
}
