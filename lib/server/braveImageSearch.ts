/**
 * Brave Search API for image search.
 * Requires BRAVE_SEARCH_API_KEY (X-Subscription-Token).
 *
 * Setup: https://api-dashboard.search.brave.com/
 * - Create account, get API key
 * - Free tier: 2,000 queries/month, 1 request per second (rate_limit: 1). Caller must throttle;
 *   imageSearch.ts waits ~1.1s between calls. 429 = rate limit (slow down) or quota exceeded (monthly limit).
 *
 * We get one result set per query; we filter store domains and low-quality URLs. We cannot request
 * "only from these sites"—if Brave returns only store URLs, we end up with zero after filtering.
 *
 * Quality: Brave often returns low-res thumbnails. We prefer properties.url (original/full-size)
 * over thumbnail.src, and filter by max(width,height) so vertical portraits are preserved.
 * SOFT FILTERING: Prefer high-quality but never return empty. Only hard-reject: maxDim known and < 1200, or blacklisted domains. Missing dimensions => keep. Portrait preserved via max(width, height).
 */

const BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";
const isDev = process.env.NODE_ENV === "development";

/** Only discard when maxDim is known and below this (icon-sized). Brave often returns thumbnail dimensions (200–600) for full-size URLs; use 400 so we keep those and only drop real icons. */
const MIN_DIM_HARD_REJECT = 400;

/** Blacklist only (no whitelist). Store/e-commerce and low-value domains. */
const BLACKLIST_DOMAINS =
// /sideshow\.com/i;
  /ebay\.|bidsquare\.|etsy\.|amazon\.|sideshow\.|shuttersstock\.|thehorrordome\.?walmartimages\.|pinimg\.|images-wixmp\.|redbubble\.|etsy\.|static\.|.foxsports\.|alamy\.|ebayimg\.com/i;
  // /amazon\.|ebay\.|ebayimg\.|etsy\.|alibaba|alamy|aliexpress|walmart\.|target\.|bestbuy\.|shopify\.|overstock\.|wayfair\.|homedepot\.|lowes\.|costco\.|newegg\.|bhphotovideo\.|adorama\.|buzzfeed\.com\/shopping|rakuten\.|wish\.|shein\.|zalando\.|asos\.|pinterest\.|pinimg\./i;

/** Only keep URLs whose path ends with a common image extension. Ignores links that don't look like direct image files. */
const IMAGE_EXT_REGEX = /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico)(\?|$)/i;

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
  // "pinterest.",
  // "pinimg.com",
  // "wallpaper",
  // "wallpapers.",
  // "hdwallpapers",
  // "wallpapercave",
  // "imgflip",
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

/** True if URL path has a common image extension (png, jpg, jpeg, webp, gif, bmp, avif, svg, ico). Skips links without an image extension. */
function hasImageExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return IMAGE_EXT_REGEX.test(pathname);
  } catch {
    return false;
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

/** Never require properties.url—use fallback order. Only discard if no URL at all. */
function extractImageUrl(item: BraveResultItem): { url: string; maxDim: number | null } | null {
  const rawUrl = item.properties?.url ?? item.url ?? item.thumbnail?.src ?? null;
  if (rawUrl == null || !/^https?:\/\//i.test(rawUrl)) return null;

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
    const bodyText = await res.text().catch(() => "");
    if (res.status === 429) {
      try {
        const err = JSON.parse(bodyText) as { error?: { code?: string; detail?: string; meta?: { quota_limit?: number; plan?: string } } };
        const code = err?.error?.code;
        const detail = err?.error?.detail ?? "";
        const meta = err?.error?.meta;
        if (code === "QUOTA_LIMITED" || /quota.*exceeded|limit exceeded/i.test(detail)) {
          console.warn(
            "[braveImageSearch] Brave Search monthly quota exceeded.",
            meta?.quota_limit != null ? `Limit: ${meta.quota_limit}/month (${meta?.plan ?? "Free"} plan).` : "",
            "Image search will use Unsplash fallback. To get Brave again: wait for next month or upgrade at https://api-dashboard.search.brave.com/"
          );
        } else {
          console.warn("[braveImageSearch] HTTP 429 Too Many Requests.", detail || bodyText.slice(0, 200));
        }
      } catch {
        console.warn("[braveImageSearch] HTTP 429 Too Many Requests.", bodyText.slice(0, 200));
      }
    } else if (res.status === 422) {
      try {
        const err = JSON.parse(bodyText) as { error?: { code?: string; detail?: string } };
        const code = err?.error?.code;
        const detail = err?.error?.detail ?? "";
        if (code === "SUBSCRIPTION_TOKEN_INVALID" || /subscription token|invalid.*token/i.test(detail)) {
          console.warn(
            "[braveImageSearch] Brave Search API key invalid or wrong product.",
            "Check BRAVE_SEARCH_API_KEY in .env: use the key from the Search plan at https://api-dashboard.search.brave.com/ (not Answers). No extra spaces. Restart the dev server after changing .env."
          );
        } else {
          console.warn("[braveImageSearch] HTTP 422", detail || bodyText.slice(0, 200));
        }
      } catch {
        console.warn("[braveImageSearch] HTTP 422 Unprocessable Entity.", bodyText.slice(0, 200));
      }
    } else if (DEBUG) {
      console.log("[braveImageSearch] HTTP", res.status, res.statusText, bodyText);
    }
    return [];
  }

  const data = (await res.json()) as { results?: BraveResultItem[] };
  return data.results ?? [];
}

/**
 * Run one Brave image search, apply quality filters and ranking, return best URL and alternates.
 * Caller is responsible for rate limiting (BRAVE_MIN_INTERVAL_MS).
 * Store/e-commerce domains are always filtered out—we want high-quality backgrounds, not product thumbnails.
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
  if (DEBUG || isDev) console.debug("[braveImageSearch] Brave raw results:", results.length);

  const seenNormalized = new Set<string>();
  const seenHostPath = new Set<string>();
  type Candidate = { url: string; maxDim: number | null; host: string };
  const candidates: Candidate[] = [];
  /** Last-resort: when every result is blacklisted, keep one so we don't return empty. */
  let fallbackBlacklisted: Candidate | null = null;

  for (const item of results) {
    const extracted = extractImageUrl(item);
    if (!extracted) continue;

    const { url, maxDim } = extracted;

    if (!hasImageExtension(url)) continue;

    try {
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const norm = normalizeUrl(url);
      const hp = urlHostPath(url);
      if (seenNormalized.has(norm) || seenHostPath.has(hp)) continue;
      seenNormalized.add(norm);
      seenHostPath.add(hp);

      // Soft dimension filter: only discard when we have a known dimension and it's icon-sized (< 400). Missing dims => keep.
      const maxDimVal = maxDim ?? 0;
      if (maxDimVal > 0 && maxDimVal < MIN_DIM_HARD_REJECT) continue;

      const c = { url, maxDim, host };
      if (BLACKLIST_DOMAINS.test(host)) {
        if (DEBUG) console.log("[braveImageSearch] skip blacklisted domain:", host);
        if (!fallbackBlacklisted) fallbackBlacklisted = c;
        continue;
      }

      candidates.push(c);
    } catch {
      continue;
    }
  }

  if (candidates.length === 0 && fallbackBlacklisted) {
    candidates.push(fallbackBlacklisted);
    if (DEBUG || isDev) console.debug("[braveImageSearch] Using last-resort blacklisted result to avoid empty");
  }

  if (DEBUG || isDev) console.debug("[braveImageSearch] After filtering:", candidates.length);

  if (candidates.length === 0) {
    if (DEBUG) console.log("[braveImageSearch] no results (all skipped or none returned)");
    return null;
  }

  // Ranking: prefer high-res and reputable, penalize thumb-like URLs. No hard filter—score and pick best.
  const urlPenalty = (url: string) => (isLowQualityImageUrl(url) ? -1.5 : 0);
  const scored = candidates.map((c) => ({
    ...c,
    score: resolutionScore(c.maxDim) + domainScore(c.host) + urlPenalty(c.url),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);
  const idx = Math.floor(Math.random() * top3.length);
  const picked = top3[idx]!;
  // Return all approved URLs so the editor can shuffle through them (not just top 3).
  const alternates = scored.map((c) => c.url).filter((u) => u !== picked.url);

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
