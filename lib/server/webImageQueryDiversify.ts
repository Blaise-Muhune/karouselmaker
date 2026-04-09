import { normalizeQueryForCache } from "@/lib/server/imageSearchUtils";

/** Common words that rarely help image search disambiguation. */
const STOPWORDS = new Set(
  [
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was", "one", "our", "out", "day", "get", "has",
    "him", "his", "how", "its", "may", "new", "now", "old", "see", "two", "way", "who", "boy", "did", "let", "put", "say",
    "she", "too", "use", "that", "this", "with", "from", "have", "your", "what", "when", "will", "just", "like", "into",
    "more", "some", "than", "then", "them", "very", "also", "back", "here", "over", "such", "only", "come", "made",
    "most", "make", "many", "much", "well", "were", "been", "being", "each", "other", "which", "their", "about",
    "would", "could", "should", "these", "those", "there", "where", "while", "after", "before", "because", "through",
    "slide", "tip", "why", "how", "top", "best", "ways", "things", "thing", "need", "want", "every", "really",
  ].map((w) => w.toLowerCase())
);

function dedupeWordsInQuery(q: string): string {
  const seen = new Set<string>();
  return q
    .trim()
    .split(/\s+/)
    .filter((w) => {
      const lower = w.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    })
    .join(" ");
}

function extractKeywords(text: string, max: number): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

function baseContainsAllWords(baseLower: string, words: string[]): boolean {
  return words.every((w) => baseLower.includes(w));
}

/**
 * Build ordered query variants so web image search behaves more like distinct searches per slide:
 * same AI "topic" string often normalizes to the same cache key and SERP — we append headline/body terms
 * and reorder like users refining queries.
 */
export function buildWebSearchQueryVariants(
  baseQuery: string,
  opts: { headline?: string; body?: string; slideIndex: number }
): string[] {
  const base = baseQuery.trim();
  if (!base) return [];

  const headline = (opts.headline ?? "").trim();
  const bodySnippet = typeof opts.body === "string" ? opts.body.slice(0, 200) : "";
  const fromHeadline = extractKeywords(headline, 5);
  const fromBody = extractKeywords(bodySnippet, 4);
  const baseLower = base.toLowerCase();

  const variants: string[] = [base];

  const headlineExtra = fromHeadline.filter((w) => !baseLower.includes(w)).slice(0, 3).join(" ");
  if (headlineExtra) {
    variants.push(dedupeWordsInQuery(`${base} ${headlineExtra}`));
  }

  const bodyExtra = fromBody.filter((w) => !baseLower.includes(w)).slice(0, 2).join(" ");
  if (bodyExtra) {
    variants.push(dedupeWordsInQuery(`${base} ${bodyExtra}`));
  }

  // Lead with concrete nouns from the slide (search engines weight early tokens).
  if (fromHeadline.length >= 2 && !baseContainsAllWords(baseLower, fromHeadline.slice(0, 2))) {
    const lead = fromHeadline.slice(0, 2).join(" ");
    variants.push(dedupeWordsInQuery(`${lead} ${base}`).slice(0, 220));
  }

  // Weak positional salt: avoids identical normalized keys when headlines are empty (still on-topic via index).
  if (opts.slideIndex > 0 && fromHeadline.length === 0 && fromBody.length === 0) {
    variants.push(dedupeWordsInQuery(`${base} frame ${opts.slideIndex}`));
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of variants) {
    const t = v.trim();
    if (!t) continue;
    const k = normalizeQueryForCache(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
