/**
 * Unified image search: routes to Unsplash or Brave based on query type.
 * - Generic/atmospheric (nature, landscape, peaceful, etc.) → Unsplash first (curated, great for backgrounds)
 * - Specific (celebrities, niche topics, people) → Brave first (broader coverage)
 * - People/public-figure intent is treated as specific even when query contains generic words.
 * Rate-limited for Brave Free tier (1 req/sec). In-memory cache (24h TTL) reduces repeated API calls.
 */

import { searchBraveImage, isBraveImageSearchConfigured } from "@/lib/server/braveImageSearch";
import { searchUnsplashPhotoRandom } from "@/lib/server/unsplash";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";
const BRAVE_MIN_INTERVAL_MS = 1100; // Free tier: 1 req/sec; add small buffer

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX_ENTRIES = 500;

let lastBraveCallAt = 0;

type CacheEntry = { result: ImageSearchResult; alternates?: string[]; ts: number };
let searchCache: Map<string, CacheEntry> = new Map();

function normalizeQueryForCache(q: string): string {
  return q.trim().toLowerCase().slice(0, 200);
}

function cacheKey(provider: "brave" | "unsplash", query: string): string {
  return `${provider}:${normalizeQueryForCache(query)}`;
}

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

/** People/public-figure intent: actors, athletes, celebrities, etc. Treat as specific (Brave-first) even with generic words. */
const PEOPLE_INTENT_PATTERNS = [
  /\b(actor|actress|athlete|player|footballer|soccer|basketball|tennis|celebrity|celeb|star|singer|musician|rapper|artist|director|filmmaker)\b/i,
  /\b(portrait|headshot|press\s+photo|official\s+photo|red\s+carpet)\b/i,
  /\b(messi|ronaldo|lebron|curry|serena|federer|beyonce|taylor\s+swift|obama|trump)\b/i,
  /\b(\d{4}x\d{3,4}|3000x2000|press\s+kit)\b/i,
  /\b(oscar|grammy|emmy|tony|golden\s+globe)\b/i,
  /\b(marvel|dc\s+comics|disney|pixar)\s+(character|actor|film)\b/i,
];

/** Fictional character / franchise: prefer Brave, use key art / official artwork refiners. */
const FICTIONAL_CHARACTER_PATTERNS = [
  /\b(anime|character|fanart|fan\s+art)\b/i,
  /\b(key\s+art|official\s+artwork|concept\s+art)\b/i,
  /\b(marvel|dc\s+comics|disney|pixar|star\s+wars|harry\s+potter|lotr|game\s+of\s+thrones)\b/i,
];

function hasPeopleIntent(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return PEOPLE_INTENT_PATTERNS.some((re) => re.test(q));
}

function hasFictionalCharacterIntent(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  return FICTIONAL_CHARACTER_PATTERNS.some((re) => re.test(q));
}

/**
 * Returns true when the query suggests generic/atmospheric imagery (nature, landscape, peaceful, etc.).
 * People/public-figure intent overrides: we treat as specific (Brave-first) even if query has "calm" etc.
 */
function preferUnsplashForQuery(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (hasPeopleIntent(q) || hasFictionalCharacterIntent(q)) return false;
  return UNSPLASH_GENERIC_PATTERNS.some((re) => re.test(q));
}

/** For tests: which provider is tried first for this query. */
export function getProviderPreference(query: string): "unsplash" | "brave" {
  return preferUnsplashForQuery(query) ? "unsplash" : "brave";
}

/** Brave refiners for people/celebrity queries: run after original query if results are poor. */
const BRAVE_PEOPLE_REFINERS = [
  (q: string) => `${q} official photo`,
  (q: string) => `${q} press photo`,
  (q: string) => `${q} press kit photos`,
  (q: string) => `${q} site:commons.wikimedia.org`,
];

/** Brave refiners for fictional characters. */
const BRAVE_FICTIONAL_REFINERS = [
  (q: string) => `${q} key art`,
  (q: string) => `${q} official artwork`,
  (q: string) => `${q} concept art`,
  (q: string) => `${q} press kit`,
];

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
  /** When true, image may be copyrighted (e.g. fictional character art). For internal/metadata use. TODO: persist in slide background metadata when schema supports it. */
  license_hint?: "likely_copyrighted";
};

/**
 * Try Brave with optional refiners: original query first, then refiners sequentially (rate-limited) until we get a result.
 */
async function tryBraveWithRefiners(query: string): Promise<ImageSearchResult | null> {
  if (!isBraveImageSearchConfigured()) return null;

  const refiners = hasFictionalCharacterIntent(query)
    ? BRAVE_FICTIONAL_REFINERS
    : hasPeopleIntent(query)
      ? BRAVE_PEOPLE_REFINERS
      : [];

  const queriesToTry = [query, ...refiners.slice(0, 3).map((fn) => fn(query))];

  for (const q of queriesToTry) {
    await waitForBraveRateLimit();
    lastBraveCallAt = Date.now();
    log("trying Brave Search:", q.slice(0, 50) + (q.length > 50 ? "..." : ""));
    const result = await searchBraveImage(q);
    if (result?.url) {
      log("Brave OK:", result.url.slice(0, 60) + "...");
      const searchResult: ImageSearchResult = {
        url: result.url,
        source: "brave",
        ...(hasFictionalCharacterIntent(query) ? { license_hint: "likely_copyrighted" as const } : {}),
      };
      return searchResult;
    }
  }
  log("Brave: no result after refiners");
  return null;
}

/**
 * Search for an image: routes by query type.
 * - Generic/atmospheric → Unsplash first, then Brave fallback.
 * - Specific / people / fictional → Brave first (with refiners when people/fictional), then Unsplash fallback.
 * Results are cached (24h TTL) by provider + normalized query.
 *
 * Debug: set IMAGE_SEARCH_DEBUG=true in .env to log search flow.
 */
export async function searchImage(query: string): Promise<ImageSearchResult | null> {
  if (!query.trim()) {
    log("skip: empty query");
    return null;
  }

  const braveConfigured = isBraveImageSearchConfigured();
  const useUnsplashFirst = preferUnsplashForQuery(query);
  log("query:", JSON.stringify(query), "| preferUnsplash:", useUnsplashFirst, "| Brave configured:", braveConfigured);

  async function tryUnsplash(): Promise<ImageSearchResult | null> {
    const key = cacheKey("unsplash", query);
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      log("Unsplash cache hit");
      return cached.result;
    }
    const unsplash = await searchUnsplashPhotoRandom(query, 15);
    if (unsplash?.url) {
      log("Unsplash OK:", unsplash.url.slice(0, 60) + "...");
      const result: ImageSearchResult = {
        url: unsplash.url,
        source: "unsplash",
        unsplashDownloadLocation: unsplash.downloadLocation,
        unsplashAttribution: unsplash.attribution,
      };
      if (searchCache.size >= CACHE_MAX_ENTRIES) {
        const first = searchCache.keys().next().value;
        if (first) searchCache.delete(first);
      }
      searchCache.set(key, { result, ts: Date.now() });
      return result;
    }
    log("Unsplash: no result or error");
    return null;
  }

  async function tryBrave(): Promise<ImageSearchResult | null> {
    if (!braveConfigured) {
      log("Brave: not configured (need BRAVE_SEARCH_API_KEY)");
      return null;
    }
    const key = cacheKey("brave", query);
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      log("Brave cache hit");
      return cached.result;
    }
    const result = await tryBraveWithRefiners(query);
    if (result) {
      if (searchCache.size >= CACHE_MAX_ENTRIES) {
        const first = searchCache.keys().next().value;
        if (first) searchCache.delete(first);
      }
      searchCache.set(key, { result, ts: Date.now() });
    }
    return result;
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

/** Clear the in-memory search cache (e.g. for tests). */
export function clearImageSearchCache(): void {
  searchCache = new Map();
}
