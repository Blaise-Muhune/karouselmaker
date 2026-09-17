import { z } from "zod";
import {
  CAROUSEL_INPUT_MAX_CHARS,
  CAROUSEL_NOTES_MAX_CHARS,
  CAROUSEL_SLIDES_MAX,
  CAROUSEL_SLIDES_MIN,
  MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS,
} from "@/lib/constants";

const uuidSchema = z.string().uuid();

const checkboxBoolSchema = z
  .union([z.literal("true"), z.literal("false"), z.literal(true), z.literal(false), z.literal("on")])
  .optional()
  .transform((v) => v === "true" || v === true || v === "on");

const optionalUuidArraySchema = z.array(uuidSchema).max(MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS).optional();

export const generateCarouselInputSchema = z.object({
  project_id: uuidSchema,
  carousel_id: uuidSchema.optional(),
  input_type: z.enum(["topic", "url", "text", "document"]),
  input_value: z.string().trim().min(1).max(CAROUSEL_INPUT_MAX_CHARS),
  title: z.string().trim().min(1).max(200).optional(),
  number_of_slides: z.number().int().min(CAROUSEL_SLIDES_MIN).max(CAROUSEL_SLIDES_MAX).optional(),
  background_asset_ids: optionalUuidArraySchema,
  /** @deprecated Ignored — AI image gen removed. */
  ai_style_reference_asset_ids: optionalUuidArraySchema,
  /** @deprecated Ignored — UGC removed. */
  ugc_character_reference_asset_ids: optionalUuidArraySchema,
  /** @deprecated Ignored — product refs removed. */
  product_reference_asset_ids: optionalUuidArraySchema,
  use_ai_backgrounds: checkboxBoolSchema,
  use_stock_photos: checkboxBoolSchema,
  /** @deprecated Always treated as false. */
  use_ai_generate: checkboxBoolSchema,
  use_web_search: checkboxBoolSchema,
  /** Fast is the normal creator workflow: one writing pass without automatic web research. */
  generation_speed: z.enum(["fast", "quality"]).optional(),
  use_saved_ugc_character: checkboxBoolSchema,
  images_related_to_topic: z
    .union([z.literal("true"), z.literal("false"), z.literal(true), z.literal(false), z.literal("on")])
    .optional()
    .transform((v) => (v === undefined ? true : v === "true" || v === true || v === "on")),
  notes: z.string().trim().max(CAROUSEL_NOTES_MAX_CHARS).optional(),
  template_id: uuidSchema.optional(),
  template_ids: z.array(uuidSchema).max(3).optional(),
  viral_shorts_style: checkboxBoolSchema,
  carousel_for: z.enum(["instagram", "linkedin"]).optional(),
  product_service_input: z.string().trim().max(600).optional(),
  /**
   * When true, this run is a marketing carousel (soft product bridge allowed).
   * When false/omitted, progressive value/education only — no product pitch.
   */
  include_marketing: checkboxBoolSchema,
});
