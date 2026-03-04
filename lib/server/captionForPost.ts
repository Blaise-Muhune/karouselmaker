/**
 * Build a single caption/message string from carousel caption_variants and hashtags
 * for use when posting to Facebook, Instagram, etc.
 * Prefers short caption, then medium, then spicy. Appends hashtags.
 */
export function getCaptionAndHashtagsForPost(carousel: {
  caption_variants?: unknown;
  hashtags?: string[] | null;
}): string {
  const variants = (carousel.caption_variants ?? {}) as { short?: string; medium?: string; spicy?: string };
  const hashtags = Array.isArray(carousel.hashtags) ? carousel.hashtags : [];
  const captionBody =
    (variants.short ?? variants.medium ?? variants.spicy ?? "").trim();
  const hashtagLine =
    hashtags.length > 0
      ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
  const parts = [captionBody, hashtagLine].filter(Boolean);
  return parts.join(parts.length === 2 ? "\n\n" : "");
}
