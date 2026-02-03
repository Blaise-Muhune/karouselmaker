/**
 * Unified image search: Brave Search first when configured, Unsplash as fallback.
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

export type ImageSearchSource = "brave" | "unsplash";

/**
 * Search for an image: Brave Search first (when configured), Unsplash as fallback.
 * Returns URL and source (brave = primary, unsplash = fallback).
 * Respects Brave Free tier 1 req/sec limit.
 *
 * Debug: set IMAGE_SEARCH_DEBUG=true in .env to log search flow.
 */
export async function searchImage(
  query: string
): Promise<{ url: string; source: ImageSearchSource } | null> {
  if (!query.trim()) {
    log("skip: empty query");
    return null;
  }

  const braveConfigured = isBraveImageSearchConfigured();
  log("query:", JSON.stringify(query), "| Brave configured:", braveConfigured);

  if (braveConfigured) {
    await waitForBraveRateLimit();
    lastBraveCallAt = Date.now();
    log("trying Brave Search...");
    const result = await searchBraveImage(query);
    if (result?.url) {
      log("Brave OK:", result.url.slice(0, 60) + "...");
      return { url: result.url, source: "brave" };
    }
    log("Brave: no result or error");
  } else {
    log("Brave: not configured (need BRAVE_SEARCH_API_KEY)");
  }

  log("trying Unsplash fallback...");
  const unsplash = await searchUnsplashPhoto(query);
  if (unsplash?.url) {
    log("Unsplash OK:", unsplash.url.slice(0, 60) + "...");
    return { url: unsplash.url, source: "unsplash" };
  }
  log("Unsplash: no result or error");
  return null;
}
