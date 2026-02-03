/**
 * Unified image search: routes to Unsplash or Brave based on query type.
 * - Generic/atmospheric (nature, landscape, peaceful, etc.) → Unsplash first (curated, great for backgrounds)
 * - Specific (celebrities, niche topics) → Brave first (broader coverage)
 * Rate-limited for Brave Free tier (1 req/sec).
 */

import { searchBraveImage, isBraveImageSearchConfigured } from "@/lib/server/braveImageSearch";
import { searchUnsplashPhoto } from "@/lib/server/unsplash";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";
const BRAVE_MIN_INTERVAL_MS = 1100; // Free tier: 1 req/sec; add small buffer

let lastBraveCallAt = 0;

async function waitForBraveRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastBraveCallAt;
  if (elapsed < BRAVE_MIN_INTERVAL_MS) {
    const wait = BRAVE_MIN_INTERVAL_MS - elapsed;
    if (DEBUG) console.log("[imageSearch] rate limit: waiting", wait, "ms");
    await new Promise((r) => setTimeout(r, wait));
  }
}

function log(...args: unknown[]) {
  if (DEBUG) console.log("[imageSearch]", ...args);
}

/** Generic/atmospheric keywords: Unsplash excels at these (nature, landscapes, abstract backgrounds). */
const UNSPLASH_GENERIC_PATTERNS = [
  /\bnature\b/i,
  /\blandscape[s]?\b/i,
  /\bmountain[s]?\b/i,
  /\bforest\b/i,
  /\bocean\b/i,
  /\bsunset\b/i,
  /\bsunrise\b/i,
  /\bpeaceful\b/i,
  /\bserene\b/i,
  /\bcalm\b/i,
  /\babstract\b/i,
  /\bminimal\b/i,
  /\binspirational\b/i,
  /\bencouraging\b/i,
  /\bbible\b/i,
  /\bverse\b/i,
  /\bspiritual\b/i,
  /\bhand\s+holding\b/i,
  /\bcityscape\b/i,
  /\bfuture\s+city\b/i,
  /\bdawn\b/i,
  /\bdusk\b/i,
  /\bhorizon\b/i,
  /\bmeadow\b/i,
  /\bvalley\b/i,
  /\bbeach\b/i,
  /\blake\b/i,
  /\briver\b/i,
  /\bwaterfall\b/i,
  /\bclouds?\b/i,
  /\bsky\b/i,
  /\blight\s+(bulb|ray|beam)?\b/i,
  /\bholding\s+light\b/i,
  /\bsoft\s+light\b/i,
  /\bwarm\s+light\b/i,
  /\bgolden\s+hour\b/i,
  /\bmisty\b/i,
  /\bfoggy\b/i,
  /\bautumn\b/i,
  /\bspring\b/i,
  /\bwinter\b/i,
  /\bsummer\b/i,
  /\bmeditation\b/i,
  /\bzen\b/i,
  /\btranquil\b/i,
  /\bhopeful\b/i,
  /\bhopefulness\b/i,
];

/**
 * Returns true when the query suggests generic/atmospheric imagery (nature, landscape, peaceful, etc.).
 * Unsplash excels at these; Brave is better for specific people, celebrities, niche topics.
 */
function preferUnsplashForQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return UNSPLASH_GENERIC_PATTERNS.some((re) => re.test(q));
}

export type ImageSearchSource = "brave" | "unsplash";

export type UnsplashAttribution = {
  photographerName: string;
  photographerUsername: string;
  profileUrl: string;
  unsplashUrl: string;
};

export type ImageSearchResult = {
  url: string;
  source: ImageSearchSource;
  /** Unsplash only: for attribution and download tracking */
  unsplashDownloadLocation?: string;
  unsplashAttribution?: UnsplashAttribution;
};

/**
 * Search for an image: routes by query type.
 * - Generic/atmospheric (nature, landscape, peaceful, etc.) → Unsplash first
 * - Specific (celebrities, niche) → Brave first
 * Falls back to the other provider if the first returns nothing.
 *
 * Debug: set IMAGE_SEARCH_DEBUG=true in .env to log search flow.
 */
export async function searchImage(
  query: string
): Promise<ImageSearchResult | null> {
  if (!query.trim()) {
    log("skip: empty query");
    return null;
  }

  const braveConfigured = isBraveImageSearchConfigured();
  const useUnsplashFirst = preferUnsplashForQuery(query);
  log("query:", JSON.stringify(query), "| preferUnsplash:", useUnsplashFirst, "| Brave configured:", braveConfigured);

  async function tryUnsplash(): Promise<ImageSearchResult | null> {
    const unsplash = await searchUnsplashPhoto(query);
    if (unsplash?.url) {
      log("Unsplash OK:", unsplash.url.slice(0, 60) + "...");
      return {
        url: unsplash.url,
        source: "unsplash",
        unsplashDownloadLocation: unsplash.downloadLocation,
        unsplashAttribution: unsplash.attribution,
      };
    }
    log("Unsplash: no result or error");
    return null;
  }

  async function tryBrave(): Promise<ImageSearchResult | null> {
    if (!braveConfigured) {
      log("Brave: not configured (need BRAVE_SEARCH_API_KEY)");
      return null;
    }
    await waitForBraveRateLimit();
    lastBraveCallAt = Date.now();
    log("trying Brave Search...");
    const result = await searchBraveImage(query);
    if (result?.url) {
      log("Brave OK:", result.url.slice(0, 60) + "...");
      return { url: result.url, source: "brave" };
    }
    log("Brave: no result or error");
    return null;
  }

  if (useUnsplashFirst) {
    const r = await tryUnsplash();
    if (r) return r;
    return tryBrave();
  }

  const r = await tryBrave();
  if (r) return r;
  return tryUnsplash();
}
