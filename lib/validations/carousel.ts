import { z } from "zod";
import { MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS } from "@/lib/constants";

const REF_CAP = MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS;

const uuidArray = (max: number) =>
  z
    .array(z.string())
    .max(max)
    .optional()
    .transform((arr) => {
      if (!arr?.length) return undefined;
      const out: string[] = [];
      for (const id of arr) {
        if (z.string().uuid().safeParse(id).success) out.push(id);
        if (out.length >= max) break;
      }
      return out.length ? out : undefined;
    });

export const generateCarouselInputSchema = z
  .object({
  project_id: z.string().uuid(),
  /** When set, regenerate in place instead of creating a new carousel. */
  carousel_id: z.string().uuid().optional(),
  input_type: z.enum(["topic", "url", "text", "document"]),
  input_value: z.string().min(1, "Input is required").max(20000),
  title: z.string().max(200).optional(),
  /** Optional. If set, AI generates exactly this many slides. If omitted, AI decides the best number. */
  number_of_slides: z.coerce.number().int().min(3).max(12).optional(),
  /** Optional asset IDs to use as slide backgrounds (round-robin). Max 30 per carousel (one per slide). */
  background_asset_ids: z.array(z.string().uuid()).max(30).optional(),
  /** Optional library assets to steer AI-generated image style for this run (merged with project refs). */
  ai_style_reference_asset_ids: uuidArray(REF_CAP),
  /** Optional per-run UGC character refs. Used when project "same person" lock is off. */
  ugc_character_reference_asset_ids: uuidArray(REF_CAP),
  /**
   * Product / app / service reference images (screenshots, packaging, product-on-person).
   * Summarized for image prompts; favors PiP-friendly compositions when the slide is about that offering.
   */
  product_reference_asset_ids: uuidArray(REF_CAP),
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
  notes: z.string().max(8000).optional(),
  /** Optional template ID to apply to all slides. If omitted, app default template is used. */
  template_id: z.string().uuid().optional(),
  /** When true, generate in "Viral Shorts" style: curiosity-gap/contrarian hook, story build-up, one natural mid-carousel engagement slide, payoff, follow CTA. */
  viral_shorts_style: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  /** Target platform: instagram (default) or linkedin. LinkedIn uses B2B-optimized content and disables AI-generated images. */
  carousel_for: z.enum(["instagram", "linkedin"]).optional(),
  /** UGC: apply project saved character for AI generate. Default true when omitted. */
  use_saved_ugc_character: z
    .string()
    .optional()
    .transform((v) => v !== "false" && v !== "0"),
})
  .superRefine((data, ctx) => {
    const style = data.ai_style_reference_asset_ids ?? [];
    const ugc = data.ugc_character_reference_asset_ids ?? [];
    const product = data.product_reference_asset_ids ?? [];
    const seen = new Set<string>();
    for (const id of [...style, ...ugc, ...product]) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each reference image can only appear in one category (characters, style, or product).",
        });
        return;
      }
      seen.add(id);
    }
    const n = style.length + ugc.length + product.length;
    if (n > REF_CAP) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `At most ${REF_CAP} reference images combined (characters + style + product).`,
      });
    }
  });

export type GenerateCarouselInput = z.output<typeof generateCarouselInputSchema>;
