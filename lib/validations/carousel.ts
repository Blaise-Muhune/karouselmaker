import { z } from "zod";

export const generateCarouselInputSchema = z.object({
  project_id: z.string().uuid(),
  /** When set, regenerate in place instead of creating a new carousel. */
  carousel_id: z.string().uuid().optional(),
  input_type: z.enum(["topic", "url", "text"]),
  input_value: z.string().min(1, "Input is required").max(10000),
  title: z.string().max(200).optional(),
  /** Optional. If set, AI generates exactly this many slides. If omitted, AI decides the best number. */
  number_of_slides: z.coerce.number().int().min(1).max(30).optional(),
  /** Optional asset IDs to use as slide backgrounds (round-robin). Max 4 per carousel. */
  background_asset_ids: z.array(z.string().uuid()).max(4).optional(),
  /** When true, AI suggests Unsplash search queries per slide and we fetch those images as backgrounds. */
  use_ai_backgrounds: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** When true and use_ai_backgrounds is true, only Unsplash is used for images (no Brave). Guaranteed quality but mostly generic. */
  use_unsplash_only: z
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
});

export type GenerateCarouselInput = z.output<typeof generateCarouselInputSchema>;
