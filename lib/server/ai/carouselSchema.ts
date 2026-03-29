import { z } from "zod";
import {
  ABSOLUTE_MAX_BODY_CHARS,
  ABSOLUTE_MAX_HEADLINE_CHARS,
} from "@/lib/server/ai/templateContextForPrompt";

const slideTypeEnum = z.enum(["hook", "point", "context", "cta", "generic"]);

/** Words/phrases from the text to highlight (exact substring match). Used by "Auto" in the editor. */
const highlightWordsSchema = z.array(z.string().min(1).max(60)).max(8).optional();

/**
 * Zod schema for carousel LLM output.
 * Headline/body use absolute safety caps only. Template zone sizes are communicated in the prompt;
 * we do not enforce template character limits in validation so copy is never truncated mid-word by the server.
 */
export function createCarouselOutputSchema() {
  const h = ABSOLUTE_MAX_HEADLINE_CHARS;
  const b = ABSOLUTE_MAX_BODY_CHARS;

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

export const carouselOutputSchema = createCarouselOutputSchema();

export type CarouselOutput = z.output<typeof carouselOutputSchema>;
export type AISlide = CarouselOutput["slides"][number];
