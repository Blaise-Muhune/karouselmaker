/**
 * Build a single post caption for LinkedIn document carousels: opening line (title) +
 * body (medium, or long if medium empty) + hashtags. The first ~140–210 characters
 * appear before "see more"—title should be the strongest hook line.
 */
export function buildLinkedInCarouselCaption(carousel: {
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
  const title = (variants.title ?? variants.short ?? "").trim();
  const medium = (variants.medium ?? "").trim();
  const long = (variants.long ?? variants.spicy ?? "").trim();
  const bodyBlock = medium || long;
  const hashtagLine =
    hashtags.length > 0
      ? hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")
      : "";
  const parts: string[] = [];
  if (title) parts.push(title);
  if (bodyBlock) parts.push(bodyBlock);
  const text = parts.join("\n\n");
  return [text, hashtagLine].filter(Boolean).join("\n\n");
}
