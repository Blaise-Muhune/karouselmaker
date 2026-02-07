"use server";

import { searchUnsplashPhotoRandom } from "@/lib/server/unsplash";

/**
 * Derive a search query from slide headline and body for Unsplash.
 * Strips markdown/formatting and takes meaningful words.
 */
function deriveSearchQuery(headline: string, body: string): string {
  const combined = `${headline} ${body}`.trim();
  if (!combined) return "abstract minimal";

  // Remove **bold**, {{highlight}}, URLs, extra punctuation
  let text = combined
    .replace(/\*\*[^*]*\*\*/g, "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .replace(/[#*_`\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "abstract minimal";

  // Take first ~50 chars or first 6 words, whichever is shorter
  const words = text.split(/\s+/).filter((w) => w.length > 1);
  const take = Math.min(6, words.length);
  const query = words.slice(0, take).join(" ").slice(0, 60);

  return query || "abstract minimal";
}

export type GetRandomUnsplashResult =
  | { url: string; attribution: { photographerName: string; photographerUsername: string; profileUrl: string; unsplashUrl: string } }
  | { error: string };

export async function getRandomUnsplashImage(
  headline: string,
  body: string
): Promise<GetRandomUnsplashResult> {
  const query = deriveSearchQuery(headline, body);
  const result = await searchUnsplashPhotoRandom(query);

  if (!result?.url) {
    return { error: "No image found. Try a different topic or check Unsplash API key." };
  }

  return {
    url: result.url,
    attribution: result.attribution ?? {
      photographerName: "Unsplash",
      photographerUsername: "unsplash",
      profileUrl: "https://unsplash.com/?utm_source=karouselmaker&utm_medium=referral",
      unsplashUrl: "https://unsplash.com/?utm_source=karouselmaker&utm_medium=referral",
    },
  };
}
