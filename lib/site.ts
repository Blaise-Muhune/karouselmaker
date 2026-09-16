export const SITE_URL =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")
    : "https://karouselmaker.com";

export const SITE_NAME = "Karouselmaker";

export const SITE_DESCRIPTION =
  "Create value-first Instagram and TikTok carousels that organically promote your product or service without sounding like ads. Generate the slides, captions, and hashtags in one focused workflow.";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
