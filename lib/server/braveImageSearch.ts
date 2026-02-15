/**
 * Brave Search API for image search.
 * Requires BRAVE_SEARCH_API_KEY (X-Subscription-Token).
 *
 * Setup: https://api-dashboard.search.brave.com/
 * - Create account, get API key
 * - Free tier: 2,000 queries/month
 *
 * Quality: Brave often returns low-res thumbnails. We prefer properties.url (original/full-size)
 * over thumbnail.src, and filter by max(width,height) so vertical portraits (e.g. 1600x2400)
 * are kept when MIN_DIM=2400 (max preserves portrait).
 */

const BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";

/** Min dimension (max of width/height) for quality. Using max() preserves vertical portraits (e.g. 1600x2400 passes). */
const MIN_DIM_STRICT = 2400;
/** Relax to this if fewer than MIN_CANDIDATES pass strict. */
const MIN_DIM_RELAXED = 1600;
/** Always discard below this (thumbnails / icons). */
const MIN_DIM_ABSOLUTE = 1200;
const MIN_CANDIDATES_BEFORE_RELAX = 3;

/** Skip image URLs from store/e-commerce domains unless the user explicitly wants product images. */
const STORE_DOMAINS =
  /amazon\.|ebay\.|ebayimg\.|etsy\.|alibaba|alamy|aliexpress|walmart\.|target\.|bestbuy\.|shopify\.|overstock\.|wayfair\.|homedepot\.|lowes\.|costco\.|newegg\.|bhphotovideo\.|adorama\.|buzzfeed\.com\/shopping|rakuten\.|wish\.|shein\.|zalando\.|asos\./i;

/** URL path/query patterns that usually indicate low-res or junk (thumbnails, avatars, icons). */
const LOW_QUALITY_URL_PATTERNS =
  /thumb|thumbnail|small|avatar|icon|sprite|150x|300x|lowres|_thumb|_sm\.|-thumb|-small|\/thumb\/|\/small\//i;

/** Domains we trust for high-quality imagery (bonus in ranking). */
const REPUTABLE_DOMAINS = [
  "commons.wikimedia.org",
  "loc.gov",
  "metmuseum.org",
  "nga.gov",
  "nasa.gov",
  "esa.int",
  "gettyimages.com",
  "reuters.com",
  "apimages.com",
];

/** Domains to penalize (aggregators, wallpapers, often lower quality or licensing issues). */
const PENALTY_DOMAINS = [
  "pinterest.",
  "pinimg.com",
  "wallpaper",
  "wallpapers.",
  "hdwallpapers",
  "wallpapercave",
  "imgflip",
  "memes.",
];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = { url: string; alternates: string[]; ts: number };

let resultCache: Map<string, CacheEntry> = new Map();

function normalizeQueryForCache(q: string): string {
  return q.trim().toLowerCase().slice(0, 200);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    return u.href;
  } catch {
    return url;
  }
}

function urlHostPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}`;
  } catch {
    return url;
  }
}

/** Returns true if URL looks like low-quality (thumbnail, icon, etc.). */
export function isLowQualityImageUrl(url: string): boolean {
  return LOW_QUALITY_URL_PATTERNS.test(url);
}

/** Get max dimension from optional width/height. Uses max() so portrait (e.g. 1600x2400) is judged by 2400. */
export function getMaxDimension(width: number | null | undefined, height: number | null | undefined): number | null {
  if (width != null && height != null && Number.isFinite(width) && Number.isFinite(height)) {
    return Math.max(Number(width), Number(height));
  }
  return null;
}

/** Returns true if image passes min dimension. Pass null when dimensions unknown (we keep the image). */
export function passesMinDimension(maxDim: number | null, minDim: number): boolean {
  if (maxDim == null) return true; // unknown => keep
  return maxDim >= minDim;
}

/** Domain score: positive for reputable, negative for penalty domains, 0 otherwise. */
function domainScore(host: string): number {
  const h = host.toLowerCase();
  if (REPUTABLE_DOMAINS.some((d) => h.includes(d))) return 2;
  if (PENALTY_DOMAINS.some((d) => h.includes(d))) return -2;
  return 0;
}

/** Resolution score for ranking (higher = better). Uses log2 so 2400 vs 1200 is ~1 point difference. */
function resolutionScore(maxDim: number | null): number {
  if (maxDim == null || maxDim < 100) return 0;
  return Math.log2(Math.max(100, maxDim));
}

/** Score a candidate for ranking (used in tests). Higher = better. */
export function scoreCandidateForRanking(maxDim: number | null, host: string): number {
  return resolutionScore(maxDim) + domainScore(host);
}

type BraveResultItem = {
  url?: string;
  properties?: { url?: string };
  thumbnail?: { src?: string; width?: number; height?: number };
  width?: number;
  height?: number;
};

function extractImageUrl(item: BraveResultItem): { url: string; maxDim: number | null } | null {
  // Prefer original/full-size: properties.url first, then url; thumbnail.src is often low-res.
  const rawUrl = item.properties?.url ?? item.url ?? item.thumbnail?.src;
  if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return null;

  const width = item.width ?? item.thumbnail?.width ?? null;
  const height = item.height ?? item.thumbnail?.height ?? null;
  const maxDim = getMaxDimension(width, height);

  return { url: rawUrl, maxDim };
}

async function fetchBraveResults(query: string): Promise<BraveResultItem[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !query.trim()) return [];

  const q = query.trim().slice(0, 200);
  const params = new URLSearchParams({
    q,
    count: "20",
    safesearch: "strict",
  });

  const url = `${BRAVE_IMAGE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": apiKey },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (DEBUG) console.log("[braveImageSearch] HTTP", res.status, res.statusText, await res.text().catch(() => ""));
    return [];
  }

  const data = (await res.json()) as { results?: BraveResultItem[] };
  return data.results ?? [];
}

/**
 * Run one Brave image search, apply quality filters and ranking, return best URL and alternates.
 * Caller is responsible for rate limiting (BRAVE_MIN_INTERVAL_MS).
 */
export async function searchBraveImage(query: string): Promise<{ url: string; alternates?: string[] } | null> {
  const cacheKey = `brave:${normalizeQueryForCache(query)}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    if (DEBUG) console.log("[braveImageSearch] cache hit:", query.slice(0, 40));
    return { url: cached.url, alternates: cached.alternates };
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !query.trim()) {
    if (DEBUG) console.log("[braveImageSearch] skip: missing BRAVE_SEARCH_API_KEY or query");
    return null;
  }

  const results = await fetchBraveResults(query);
  const seenNormalized = new Set<string>();
  const seenHostPath = new Set<string>();
  type Candidate = { url: string; maxDim: number | null; host: string };
  const candidates: Candidate[] = [];

  for (const item of results) {
    const extracted = extractImageUrl(item);
    if (!extracted) continue;

    const { url, maxDim } = extracted;
    if (isLowQualityImageUrl(url)) continue;

    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      if (STORE_DOMAINS.test(host)) {
        if (DEBUG) console.log("[braveImageSearch] skip store domain:", host);
        continue;
      }
      const norm = normalizeUrl(url);
      const hp = urlHostPath(url);
      if (seenNormalized.has(norm) || seenHostPath.has(hp)) continue;
      seenNormalized.add(norm);
      seenHostPath.add(hp);

      if (!passesMinDimension(maxDim, MIN_DIM_ABSOLUTE)) continue;
      candidates.push({ url, maxDim, host });
    } catch {
      continue;
    }
  }

  if (candidates.length === 0) {
    if (DEBUG) console.log("[braveImageSearch] no results (all skipped or none returned)");
    return null;
  }

  const minDim = candidates.filter((c) => passesMinDimension(c.maxDim, MIN_DIM_STRICT)).length >= MIN_CANDIDATES_BEFORE_RELAX
    ? MIN_DIM_STRICT
    : MIN_DIM_RELAXED;

  const passing = candidates.filter((c) => passesMinDimension(c.maxDim, minDim));
  if (passing.length === 0) {
    if (DEBUG) console.log("[braveImageSearch] no candidates passed min dimension", minDim);
    return null;
  }

  const scored = passing.map((c) => ({
    ...c,
    score: resolutionScore(c.maxDim) + domainScore(c.host),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  const idx = Math.floor(Math.random() * top3.length);
  const picked = top3[idx]!;
  const alternates = top3.map((c) => c.url).filter((u) => u !== picked.url);

  if (resultCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = resultCache.keys().next().value;
    if (firstKey) resultCache.delete(firstKey);
  }
  resultCache.set(cacheKey, { url: picked.url, alternates, ts: Date.now() });

  return { url: picked.url, alternates };
}

export function isBraveImageSearchConfigured(): boolean {
  return !!process.env.BRAVE_SEARCH_API_KEY;
}

/** Clear the in-memory cache (e.g. for tests). */
export function clearBraveImageSearchCache(): void {
  resultCache = new Map();
}
