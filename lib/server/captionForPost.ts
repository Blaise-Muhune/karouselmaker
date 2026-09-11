export { buildLinkedInCarouselCaption } from "@/lib/caption/linkedinPostCaption";

/**
 * Build a single caption/message string from carousel caption_variants and hashtags
 * for use when posting to Facebook, Instagram, etc.
 * Prefers long caption, then medium, then title. Legacy: spicy/short. Appends hashtags.
 */
export function getCaptionAndHashtagsForPost(carousel: {
  caption_variants?: unknown;
  hashtags?: string[] | null;
}): string {
  const variants = (carousel.caption_variants ?? {}) as {
    title?: string;
    medium?: string;
    long?: string;
    short?: string;
    spicy?: string;
  };
  const hashtags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];
  const captionBody = (
    variants.long ??
    variants.spicy ??
    variants.medium ??
    variants.title ??
    variants.short ??
    ""
  ).trim();
  const hashtagLine =
    hashtags.length > 0
      ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
  const parts = [captionBody, hashtagLine].filter(Boolean);
  return parts.join(parts.length === 2 ? "\n\n" : "");
}
