import type { AISlide, CarouselOutput } from "@/lib/server/ai/carouselSchema";

/** Tokens meant for stock/search, not AI image generation—strip at source. */
const BANNED_AI_QUERY_TOKENS =
  /\b(4k|8k|3000x2000|3000\s*x\s*2000|official\s+photo|wallpaper|hd\s+resolution|ultra\s+hd|uhd|stock\s+photo)\b/gi;

/**
 * After this many slides include a phrase, strip it from later slides (variety).
 */
const MAX_USES_PER_STYLE_PHRASE = 2;

const REPEATABLE_STYLE_PHRASES: { source: string; flags: string; normalized: string }[] = [
  { source: "\\bdramatic\\s+lighting\\b", flags: "gi", normalized: "dramatic lighting" },
  { source: "\\bcinematic\\b", flags: "gi", normalized: "cinematic" },
  { source: "\\batmospheric\\b", flags: "gi", normalized: "atmospheric" },
  { source: "\\bintense\\s+close-?up\\b", flags: "gi", normalized: "intense close-up" },
  { source: "\\bdramatic\\s+silhouette\\b", flags: "gi", normalized: "dramatic silhouette" },
  { source: "\\bwarm\\s+backlighting\\b", flags: "gi", normalized: "warm backlighting" },
];

function stripBannedTokens(q: string): string {
  return q.replace(BANNED_AI_QUERY_TOKENS, " ").replace(/\s{2,}/g, " ").trim();
}

function applyStylePhraseBudget(text: string, phraseCounts: Map<string, number>): string {
  let out = text;
  for (const { source, flags, normalized } of REPEATABLE_STYLE_PHRASES) {
    const re = new RegExp(source, flags);
    if (!re.test(out)) continue;
    const used = phraseCounts.get(normalized) ?? 0;
    re.lastIndex = 0;
    if (used >= MAX_USES_PER_STYLE_PHRASE) {
      out = out.replace(re, " ").replace(/\s{2,}/g, " ").trim();
    } else {
      phraseCounts.set(normalized, used + 1);
    }
  }
  return out;
}

function queriesFromSlide(slide: AISlide): string[] {
  if (slide.image_queries?.length) return slide.image_queries.map((q) => String(q));
  if (slide.image_query?.trim()) return [slide.image_query.trim()];
  return [];
}

function assignQueriesToSlide(slide: AISlide, queries: string[]): AISlide {
  const cleaned = queries.map((q) => q.trim()).filter((q) => q.length > 0);
  if (cleaned.length === 0) {
    return { ...slide, image_queries: undefined, image_query: undefined };
  }
  if (cleaned.length === 1) {
    return { ...slide, image_queries: undefined, image_query: cleaned[0] };
  }
  return { ...slide, image_queries: cleaned, image_query: undefined };
}

/**
 * Post-process LLM image_queries for AI image generation: strip search
 * artifacts and reduce repeated style cues across slides (by slide_index order).
 */
export function postProcessAiGeneratedImageQueries(
  output: CarouselOutput,
  useAiGenerate: boolean
): CarouselOutput {
  if (!useAiGenerate) return output;

  const sorted = [...output.slides].sort((a, b) => a.slide_index - b.slide_index);
  const phraseCounts = new Map<string, number>();
  const byIndex = new Map<number, AISlide>();

  for (const slide of sorted) {
    const rawQs = queriesFromSlide(slide);
    const processed: string[] = [];
    for (const q of rawQs) {
      let text = stripBannedTokens(q);
      if (!text) continue;
      text = applyStylePhraseBudget(text, phraseCounts);
      if (text) processed.push(text);
    }
    const fallback = rawQs[0] ? stripBannedTokens(rawQs[0]).slice(0, 80) : "";
    const finalQs =
      processed.length > 0 ? processed : fallback ? [fallback] : [];
    byIndex.set(slide.slide_index, assignQueriesToSlide(slide, finalQs));
  }

  const slides = output.slides.map((s) => byIndex.get(s.slide_index) ?? s);
  return { ...output, slides };
}
