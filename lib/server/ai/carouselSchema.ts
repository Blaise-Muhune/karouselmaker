import { z } from "zod";
import {
  ABSOLUTE_MAX_BODY_CHARS,
  ABSOLUTE_MAX_HEADLINE_CHARS,
} from "@/lib/server/ai/templateContextForPrompt";

const slideTypeEnum = z.enum(["hook", "point", "context", "cta", "generic"]);

/** Words/phrases from the text to highlight (exact substring match). Used by "Auto" in the editor. */
const highlightWordsSchema = z.array(z.string().min(1).max(60)).max(8).optional();

export type SlideTextLimits = { headlineMax: number; bodyMax: number };

function clampLimits(limits: SlideTextLimits): { h: number; b: number } {
  const h = Math.min(
    ABSOLUTE_MAX_HEADLINE_CHARS,
    Math.max(1, Math.floor(limits.headlineMax))
  );
  const b = Math.min(
    ABSOLUTE_MAX_BODY_CHARS,
    Math.max(0, Math.floor(limits.bodyMax))
  );
  return { h, b };
}

/**
 * Zod schema for carousel LLM output with per-template headline/body max lengths
 * (from template text zones). Use {@link DEFAULT_CAROUSEL_TEXT_LIMITS} when no template.
 */
export function createCarouselOutputSchema(limits: SlideTextLimits) {
  const { h, b } = clampLimits(limits);

  const shortenAlternateSchema = z.object({
    headline: z.string().max(h),
    body: z.string().max(b).optional().default(""),
    headline_highlight_words: highlightWordsSchema,
    body_highlight_words: highlightWordsSchema,
    variant: z.enum(["short", "normal", "long"]).optional(),
  });

  const aiSlideSchema = z.object({
    slide_index: z.number().int().min(1),
    slide_type: slideTypeEnum,
    headline: z.string().max(h),
    body: z.string().max(b).optional().default(""),
    headline_highlight_words: highlightWordsSchema,
    body_highlight_words: highlightWordsSchema,
    image_query: z.string().max(80).optional(),
    image_queries: z.array(z.string().max(80)).max(4).optional(),
    image_context: z
      .object({
        year: z.string().max(30).optional(),
        location: z.string().max(60).optional(),
      })
      .optional(),
    image_provider: z.enum(["unsplash", "pexels", "pixabay"]).optional(),
    unsplash_query: z.string().max(80).optional(),
    unsplash_queries: z.array(z.string().max(80)).max(4).optional(),
    shorten_alternates: z.array(shortenAlternateSchema).min(0).max(3).optional(),
  });

  return z.object({
    title: z.string().min(1).max(200),
    slides: z.array(aiSlideSchema),
    caption_variants: z
      .object({
        title: z.string().max(120).optional().default(""),
        medium: z.string().max(400).optional().default(""),
        long: z.string().max(800).optional().default(""),
      })
      .optional()
      .default({ title: "", medium: "", long: "" }),
    hashtags: z.array(z.string().max(50)).max(15).optional().default([]),
    similar_ideas: z.array(z.string().min(1).max(200)).max(8).optional().default([]),
  });
}

/** Legacy default when template limits are not applied (narrow caps). */
export const DEFAULT_CAROUSEL_TEXT_LIMITS: SlideTextLimits = {
  headlineMax: 120,
  bodyMax: 600,
};

export const carouselOutputSchema = createCarouselOutputSchema(DEFAULT_CAROUSEL_TEXT_LIMITS);

export type CarouselOutput = z.output<typeof carouselOutputSchema>;
export type AISlide = CarouselOutput["slides"][number];
