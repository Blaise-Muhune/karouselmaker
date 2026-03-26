/**
 * Rough topic classification for AI image strategy (public figures vs generic faces).
 * False positives are OK: defaulting to non-fiction only adds a first-pass “recognizable figure” nudge.
 */

const FICTION_HINTS =
  /\b(fantasy|sci-?fi|science fiction|fictional|fan\s*fiction|fanfiction|anime|manga|isekai|manhwa|webtoon|\bmarvel\b|\bdc comics\b|superhero\s+(movie|show|series)|harry potter|hogwarts|lord of the rings|middle-?earth|tolkien|d\s*&\s*d\b|\bdnd\b|dungeons?\s+and\s+dragons|dragon\s|wizarding|fairy\s*tale|fanfic|vtuber|original character|\boc\b|fictional character|video game character|minecraft|roblox\s+story|fan\s*art|lore\s+only|spider-?man|batman|superman|wolverine|deadpool|iron\s+man|captain\s+america|wonder\s+woman)\b/i;

export function isLikelyFictionTopic(topic: string | null | undefined, title?: string | null): boolean {
  const t = `${topic ?? ""}\n${title ?? ""}`.trim();
  if (!t) return false;
  return FICTION_HINTS.test(t);
}

export function preferRecognizablePublicFiguresForImages(
  topic: string | null | undefined,
  title?: string | null
): boolean {
  return !isLikelyFictionTopic(topic, title);
}
