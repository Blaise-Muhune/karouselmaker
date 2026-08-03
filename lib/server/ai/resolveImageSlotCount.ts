/** Matches schema / generateCarousel: at most this many image slots per slide. */
export const MAX_IMAGE_SLOTS_PER_SLIDE = 4;

/**
 * If carousel notes explicitly ask for N images (or “multiple”), return that count (1–4).
 * Otherwise null — caller uses the default (1, or 2 for comparison).
 */
export function parseRequestedImageSlotCountFromNotes(notes: string | undefined | null): number | null {
  const lower = (notes ?? "").trim().toLowerCase();
  if (!lower) return null;

  const clamp = (n: number) => Math.min(MAX_IMAGE_SLOTS_PER_SLIDE, Math.max(1, Math.floor(n)));

  const atLeast =
    lower.match(/\bat\s+least\s+(\d+)\s*(?:images?|photos?|pics?|pictures?|shots?)\b/) ||
    lower.match(/\b(\d+)\s*(?:images?|photos?|pics?|pictures?|shots?)\s+or\s+more\b/);
  if (atLeast?.[1]) {
    const n = parseInt(atLeast[1], 10);
    if (Number.isFinite(n)) return clamp(n);
  }

  const explicit =
    lower.match(/\b(\d+)\s*(?:images?|photos?|pics?|pictures?|shots?)\b/) ||
    lower.match(/\b(?:images?|photos?|pics?|pictures?|shots?)\s*(?:per\s+slide\s*)?[:=]?\s*(\d+)\b/);
  if (explicit) {
    const n = parseInt(explicit[1] || explicit[2] || "", 10);
    if (Number.isFinite(n) && n >= 1) return clamp(n);
  }

  if (
    /\b(multiple|several|a\s+few|collage|montage|multi[-\s]?image|image\s+grid|grid\s+of\s+images|more\s+than\s+one\s+image)\b/.test(
      lower
    )
  ) {
    return 2;
  }

  return null;
}

/**
 * How many visible image slots to put on a slide for web/stock search results.
 * - Notes can raise this (e.g. “3 images per slide”) up to 4.
 * - Without notes: 1 by default; 2 if the model emitted two image_queries (comparison).
 */
export function resolveDesiredImageSlots(
  queriesCount: number,
  notes?: string | null
): number {
  const q = Math.max(0, Math.floor(queriesCount));
  const fromNotes = parseRequestedImageSlotCountFromNotes(notes);
  if (fromNotes != null) {
    return Math.min(MAX_IMAGE_SLOTS_PER_SLIDE, Math.max(fromNotes, q > 0 ? q : 1, 1));
  }
  if (q >= 2) return 2;
  return 1;
}
