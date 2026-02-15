/**
 * Brave Search API for image search.
 * Requires BRAVE_SEARCH_API_KEY (X-Subscription-Token).
 *
 * Setup: https://api-dashboard.search.brave.com/
 * - Create account, get API key
 * - Free tier: 2,000 queries/month
 */

const BRAVE_IMAGE_URL = "https://api.search.brave.com/res/v1/images/search";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";

/** Skip image URLs from store/e-commerce domains unless the user explicitly wants product images. */
const STORE_DOMAINS =
  /amazon\.|ebay\.|ebayimg\.|etsy\.|alibaba|alamy|aliexpress|walmart\.|target\.|bestbuy\.|shopify\.|overstock\.|wayfair\.|homedepot\.|lowes\.|costco\.|newegg\.|bhphotovideo\.|adorama\.|buzzfeed\.com\/shopping|rakuten\.|wish\.|shein\.|zalando\.|asos\./i;

export async function searchBraveImage(
  query: string
): Promise<{ url: string } | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !query.trim()) {
    if (DEBUG) console.log("[braveImageSearch] skip: missing BRAVE_SEARCH_API_KEY or query");
    return null;
  }

  const q = query.trim().slice(0, 200);
  const params = new URLSearchParams({
    q,
    count: "10",
    safesearch: "strict",
  });

  const url = `${BRAVE_IMAGE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "X-Subscription-Token": apiKey },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    if (DEBUG) console.log("[braveImageSearch] HTTP", res.status, res.statusText, await res.text().catch(() => ""));
    return null;
  }

  const data = (await res.json()) as {
    results?: Array<{
      url?: string;
      properties?: { url?: string };
      thumbnail?: { src?: string };
    }>;
  };

  const results = data.results ?? [];
  const urls: string[] = [];
  for (const item of results) {
    const imageUrl = item.properties?.url ?? item.url ?? item.thumbnail?.src;
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) continue;
    try {
      const host = new URL(imageUrl).hostname.toLowerCase();
      if (STORE_DOMAINS.test(host)) {
        if (DEBUG) console.log("[braveImageSearch] skip store domain:", host);
        continue;
      }
    } catch {
      continue;
    }
    urls.push(imageUrl);
  }

  if (urls.length === 0) {
    if (DEBUG) console.log("[braveImageSearch] no results (all skipped or none returned)");
    return null;
  }
  const idx = Math.floor(Math.random() * urls.length);
  return { url: urls[idx]! };
}

export function isBraveImageSearchConfigured(): boolean {
  return !!process.env.BRAVE_SEARCH_API_KEY;
}
