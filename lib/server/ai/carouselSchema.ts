import { z } from "zod";

const slideTypeEnum = z.enum(["hook", "point", "context", "cta", "generic"]);

export const aiSlideSchema = z.object({
  slide_index: z.number().int().min(1),
  slide_type: slideTypeEnum,
  headline: z.string().max(120),
  body: z.string().max(600).optional().default(""),
  /** Optional image search query for AI-suggested background (legacy, single image). Fetched via Brave or Unsplash. */
  image_query: z.string().max(80).optional(),
  /** Optional array of image search phrases (one per image). E.g. ["Elon Musk portrait", "Jeff Bezos portrait"] for 2 images. Max 4 per slide. Fetched via Brave or Unsplash. */
  image_queries: z.array(z.string().max(80)).max(4).optional(),
  // Legacy: accept old field names from cached or older AI output
  unsplash_query: z.string().max(80).optional(),
  unsplash_queries: z.array(z.string().max(80)).max(4).optional(),
});

export const carouselOutputSchema = z.object({
  title: z.string().min(1).max(200),
  slides: z.array(aiSlideSchema),
  caption_variants: z
    .object({
      short: z.string().max(150).optional().default(""),
      medium: z.string().max(300).optional().default(""),
      spicy: z.string().max(300).optional().default(""),
    })
    .optional()
    .default({ short: "", medium: "", spicy: "" }),
  hashtags: z.array(z.string().max(50)).max(15).optional().default([]),
});

export type CarouselOutput = z.output<typeof carouselOutputSchema>;
export type AISlide = z.output<typeof aiSlideSchema>;
