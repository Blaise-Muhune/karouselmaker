/**
 * User-facing names for image sources. Internal/API values stay
 * `brave` | `unsplash` | … — "brave" means web image search (Brave Search API).
 */
export function imageSourceDisplayName(
  source: "brave" | "unsplash" | "google" | "pixabay" | "pexels" | string | undefined | null
): string {
  switch (source) {
    case "unsplash":
      return "Unsplash";
    case "pixabay":
      return "Pixabay";
    case "pexels":
      return "Pexels";
    case "google":
      return "Google";
    case "brave":
      return "Web images";
    default:
      return source && String(source).trim() !== "" ? String(source) : "—";
  }
}

/** Short description for tooltips / help (admin: web search uses Brave). */
export const WEB_IMAGES_SOURCE_DESCRIPTION =
  "Finds images from across the web (Brave Search). Strong for specific people, places, and topics.";
