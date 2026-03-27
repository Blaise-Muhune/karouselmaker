import { z } from "zod";

export const generateCarouselInputSchema = z.object({
  project_id: z.string().uuid(),
  /** When set, regenerate in place instead of creating a new carousel. */
  carousel_id: z.string().uuid().optional(),
  input_type: z.enum(["topic", "url", "text", "document"]),
  input_value: z.string().min(1, "Input is required").max(10000),
  title: z.string().max(200).optional(),
  /** Optional. If set, AI generates exactly this many slides. If omitted, AI decides the best number. */
  number_of_slides: z.coerce.number().int().min(3).max(12).optional(),
  /** Optional asset IDs to use as slide backgrounds (round-robin). Max 30 per carousel (one per slide). */
  background_asset_ids: z.array(z.string().uuid()).max(30).optional(),
  /** When true, AI suggests Unsplash search queries per slide and we fetch those images as backgrounds. */
  use_ai_backgrounds: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** When true and use_ai_backgrounds is true, images come from stock photo APIs (Unsplash, Pexels, Pixabay). AI chooses which provider per slide. */
  use_stock_photos: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** When true and use_ai_backgrounds is true, images are generated via OpenAI (gpt-image-1-mini) instead of search. */
  use_ai_generate: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** When true, model can use web search for current info (URLs, recent topics). Uses Responses API with gpt-5-mini. */
  use_web_search: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** Optional notes or context for the AI before generating (e.g. "focus on beginners", "avoid jargon"). */
  notes: z.string().max(2000).optional(),
  /** Optional template ID to apply to all slides. If omitted, app default template is used. */
  template_id: z.string().uuid().optional(),
  /** When true, generate in "Viral Shorts" style: curiosity-gap/contrarian hook, story build-up, one natural mid-carousel engagement slide, payoff, follow CTA. */
  viral_shorts_style: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** Target platform: instagram (default) or linkedin. LinkedIn uses B2B-optimized content and disables AI-generated images. */
  carousel_for: z.enum(["instagram", "linkedin"]).optional(),
});

export type GenerateCarouselInput = z.output<typeof generateCarouselInputSchema>;
