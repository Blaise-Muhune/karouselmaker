/**
 * Build a single caption/message string from carousel caption_variants and hashtags
 * for use when posting to Facebook, Instagram, etc.
 * Prefers title (SEO), then medium (engagement), then long. Legacy: short/spicy. Appends hashtags.
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
    variants.title ??
    variants.medium ??
    variants.long ??
    variants.short ??
    variants.spicy ??
    ""
  ).trim();
  const hashtagLine =
    hashtags.length > 0
      ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
  const parts = [captionBody, hashtagLine].filter(Boolean);
  return parts.join(parts.length === 2 ? "\n\n" : "");
}
