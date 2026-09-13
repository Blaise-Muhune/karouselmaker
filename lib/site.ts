export const SITE_URL =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : "https://karouselmaker.com";

export const SITE_NAME = "Karouselmaker";

export const SITE_DESCRIPTION =
  "Create organic Instagram and TikTok carousels that teach your audience, earn the swipe, and softly promote what you sell.";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
