/**
 * Unsplash API: search for a photo and return the first result with attribution.
 * Requires UNSPLASH_ACCESS_KEY. Returns null if key missing or no results.
 * Compliant with Unsplash API Guidelines: attribution + download tracking.
 */

const UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos";
const UTM_SOURCE = "karouselmaker";
const UTM_MEDIUM = "referral";

const DEBUG = process.env.IMAGE_SEARCH_DEBUG === "true" || process.env.IMAGE_SEARCH_DEBUG === "1";

export type UnsplashAttribution = {
  photographerName: string;
  photographerUsername: string;
  profileUrl: string;
  unsplashUrl: string;
};

export type UnsplashPhotoResult = {
  url: string;
  downloadLocation?: string;
  attribution?: UnsplashAttribution;
};

export async function searchUnsplashPhoto(
  query: string
): Promise<UnsplashPhotoResult | null> {
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
      user?: { name?: string; username?: string; links?: { html?: string } };
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

  const user = first?.user;
  const profileHtml = user?.links?.html ?? (user?.username ? `https://unsplash.com/@${user.username}` : undefined);
  const attribution: UnsplashAttribution | undefined =
    user?.name && user?.username && profileHtml
      ? {
          photographerName: user.name,
          photographerUsername: user.username,
          profileUrl: `${profileHtml}?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
          unsplashUrl: `https://unsplash.com/?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
        }
      : undefined;

  return {
    url: imageUrl,
    downloadLocation: first?.links?.download_location,
    attribution,
  };
}

/**
 * Search Unsplash and return a random result from the first page.
 * Use for "shuffle" to get variety. Fetches up to 15 results and picks one at random.
 */
export async function searchUnsplashPhotoRandom(
  query: string,
  count = 15
): Promise<UnsplashPhotoResult | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query.trim()) {
    if (DEBUG) console.log("[unsplash] skip: missing UNSPLASH_ACCESS_KEY or query");
    return null;
  }

  const params = new URLSearchParams({
    query: query.trim().slice(0, 80),
    per_page: String(Math.min(30, Math.max(1, count))),
    orientation: "portrait",
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
      user?: { name?: string; username?: string; links?: { html?: string } };
    }>;
    errors?: string[];
  };

  if (data.errors?.length || !data.results?.length) {
    if (DEBUG) console.log("[unsplash] no results or API errors");
    return null;
  }

  const results = data.results;
  const idx = Math.floor(Math.random() * results.length);
  const item = results[idx]!;
  const imageUrl = item?.urls?.full ?? item?.urls?.regular;
  if (!imageUrl) return null;

  const user = item?.user;
  const profileHtml = user?.links?.html ?? (user?.username ? `https://unsplash.com/@${user.username}` : undefined);
  const attribution: UnsplashAttribution | undefined =
    user?.name && user?.username && profileHtml
      ? {
          photographerName: user.name,
          photographerUsername: user.username,
          profileUrl: `${profileHtml}?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
          unsplashUrl: `https://unsplash.com/?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}`,
        }
      : undefined;

  return {
    url: imageUrl,
    downloadLocation: item?.links?.download_location,
    attribution,
  };
}

/**
 * Trigger Unsplash download tracking. Call when user "uses" a photo (e.g. inserts into slide).
 * Required by Unsplash API Guidelines. Fire asynchronously to avoid blocking.
 * Must authorize with client_id (or bearer token) per Unsplash docs.
 */
export async function trackUnsplashDownload(downloadLocation: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;

  try {
    const res = await fetch(downloadLocation, {
      method: "GET",
      headers: { Authorization: `Client-ID ${key}` },
    });
    if (!res.ok && DEBUG) console.log("[unsplash] trackDownload HTTP", res.status);
  } catch (e) {
    if (DEBUG) console.log("[unsplash] trackDownload error:", e);
  }
}

/** Format attribution line for exports: "Photo by [Name] on Unsplash" */
export function formatUnsplashAttributionLine(attribution: UnsplashAttribution): string {
  return `Photo by ${attribution.photographerName} (https://unsplash.com/@${attribution.photographerUsername}?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM}) on Unsplash (https://unsplash.com/?utm_source=${UTM_SOURCE}&utm_medium=${UTM_MEDIUM})`;
}
