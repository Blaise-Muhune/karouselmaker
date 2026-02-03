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

export async function searchBraveImage(
  query: string
): Promise<{ url: string } | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !query.trim()) {
    if (DEBUG) console.log("[braveImageSearch] skip: missing BRAVE_SEARCH_API_KEY or query");
    return null;
  }

  // Append quality + orientation: professional photography, portrait/vertical for carousel
  const baseQuery = query.trim().slice(0, 55);
  const hasQualityTerms = /4k|high res|resolution|professional|photography|portrait|vertical/i.test(baseQuery);
  const enhancedQuery = hasQualityTerms
    ? baseQuery
    : `${baseQuery} high resolution`;

  const params = new URLSearchParams({
    q: enhancedQuery,
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
  const skipPattern = /\.gif(\?|$)|giphy|tenor|clipart|\.svg(\?|$)/i;
  const skipDomains = /pinterest|pinimg|tumblr|imgur|reddit|redd\.it|wikipedia|wikimedia|wallpapers|wallpaperaccess|alphacoders|quora|wallpapercave|blogspot|blogger|etsy|amazon\.com|knowyourmeme|deviantart|flickr/i;

  for (const item of results) {
    const imageUrl = item.properties?.url ?? item.url ?? item.thumbnail?.src;
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) continue;
    if (skipPattern.test(imageUrl)) {
      if (DEBUG) console.log("[braveImageSearch] skip GIF/clipart:", imageUrl.slice(0, 50) + "...");
      continue;
    }
    try {
      const host = new URL(imageUrl).hostname.toLowerCase();
      if (skipDomains.test(host)) {
        if (DEBUG) console.log("[braveImageSearch] skip low-quality domain:", host);
        continue;
      }
    } catch {
      continue;
    }
    return { url: imageUrl };
  }

  if (DEBUG) console.log("[braveImageSearch] no suitable results (all GIF/clipart?)");
  return null;
}

export function isBraveImageSearchConfigured(): boolean {
  return !!process.env.BRAVE_SEARCH_API_KEY;
}
