export const SITE_URL =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : "https://karouselmaker.com";

export const SITE_NAME = "Karouselmaker";

export const SITE_DESCRIPTION =
  "Create publish-ready Instagram and TikTok carousels from one project brief. Generate a clear title, swipe-worthy slides, captions, and hashtags, then refine them with polished templates.";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
