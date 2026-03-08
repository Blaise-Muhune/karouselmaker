import { z } from "zod";

const slideTypeEnum = z.enum(["hook", "point", "context", "cta", "generic"]);

/** Words/phrases from the text to highlight (exact substring match). Used by "Auto" in the editor. */
const highlightWordsSchema = z.array(z.string().min(1).max(60)).max(8).optional();

/** Shorter headline+body that still make sense (AI rewrite, not truncation). */
export const shortenAlternateSchema = z.object({
  headline: z.string().max(120),
  body: z.string().max(600).optional().default(""),
  /** Words from this alternate's headline to highlight when user clicks Auto. Must appear exactly in headline. */
  headline_highlight_words: highlightWordsSchema,
  /** Words from this alternate's body to highlight when user clicks Auto. Must appear exactly in body. */
  body_highlight_words: highlightWordsSchema,
});

export const aiSlideSchema = z.object({
  slide_index: z.number().int().min(1),
  slide_type: slideTypeEnum,
  headline: z.string().max(120),
  body: z.string().max(600).optional().default(""),
  /** Words from headline to highlight when user clicks Auto. Must appear exactly in headline. */
  headline_highlight_words: highlightWordsSchema,
  /** Words from body to highlight when user clicks Auto. Must appear exactly in body. */
  body_highlight_words: highlightWordsSchema,
  /** Optional image search query for AI-suggested background (legacy, single image). Fetched via Brave or Unsplash. */
  image_query: z.string().max(80).optional(),
  /** Optional array of image search phrases (one per image). E.g. ["Elon Musk portrait", "Jeff Bezos portrait"] for 2 images. Max 4 per slide. Fetched via Brave or Unsplash. */
  image_queries: z.array(z.string().max(80)).max(4).optional(),
  /** Optional context for AI image generation: era/year and location so images match the right time and setting. Used only when use_ai_generate is true. */
  image_context: z
    .object({
      year: z.string().max(30).optional(),
      location: z.string().max(60).optional(),
    })
    .optional(),
  /** When using stock photos (Unsplash/Pexels/Pixabay), which provider to use for this slide. AI chooses per slide. */
  image_provider: z.enum(["unsplash", "pexels", "pixabay"]).optional(),
  // Legacy: accept old field names from cached or older AI output
  unsplash_query: z.string().max(80).optional(),
  unsplash_queries: z.array(z.string().max(80)).max(4).optional(),
  /** 2–3 shorter versions of headline+body that keep meaning (semantic shorten for "Shorten to fit" cycling). Optional; omit or empty array if not needed. */
  shorten_alternates: z.array(shortenAlternateSchema).max(3).optional(),
});

export const carouselOutputSchema = z.object({
  title: z.string().min(1).max(200),
  slides: z.array(aiSlideSchema),
  caption_variants: z
    .object({
      /** SEO-friendly post title for social (discoverability). */
      title: z.string().max(120).optional().default(""),
      /** Engagement-focused caption with more explanation. */
      medium: z.string().max(400).optional().default(""),
      /** Longer caption for full context. */
      long: z.string().max(800).optional().default(""),
    })
    .optional()
    .default({ title: "", medium: "", long: "" }),
  hashtags: z.array(z.string().max(50)).max(15).optional().default([]),
});

export type CarouselOutput = z.output<typeof carouselOutputSchema>;
export type AISlide = z.output<typeof aiSlideSchema>;
