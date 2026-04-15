import { z } from "zod";
import {
  CAROUSEL_INPUT_MAX_CHARS,
  CAROUSEL_NOTES_MAX_CHARS,
  MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS,
} from "@/lib/constants";

const uuidSchema = z.string().uuid();

const checkboxBoolSchema = z
  .union([z.literal("true"), z.literal(true), z.literal("on")])
  .optional()
  .transform((v) => v === "true" || v === true || v === "on");

const optionalUuidArraySchema = z.array(uuidSchema).max(MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS).optional();

export const generateCarouselInputSchema = z
  .object({
    project_id: uuidSchema,
    carousel_id: uuidSchema.optional(),
    input_type: z.enum(["topic", "url", "text", "document"]),
    input_value: z.string().trim().min(1).max(CAROUSEL_INPUT_MAX_CHARS),
    title: z.string().trim().min(1).max(200).optional(),
    number_of_slides: z.number().int().min(1).max(30).optional(),
    background_asset_ids: optionalUuidArraySchema,
    ai_style_reference_asset_ids: optionalUuidArraySchema,
    ugc_character_reference_asset_ids: optionalUuidArraySchema,
    product_reference_asset_ids: optionalUuidArraySchema,
    use_ai_backgrounds: checkboxBoolSchema,
    use_stock_photos: checkboxBoolSchema,
    use_ai_generate: checkboxBoolSchema,
    use_web_search: checkboxBoolSchema,
    use_saved_ugc_character: checkboxBoolSchema,
    notes: z.string().trim().max(CAROUSEL_NOTES_MAX_CHARS).optional(),
    template_id: uuidSchema.optional(),
    template_ids: z.array(uuidSchema).max(3).optional(),
    viral_shorts_style: checkboxBoolSchema,
    carousel_for: z.enum(["instagram", "linkedin"]).optional(),
    product_service_input: z.string().trim().max(600).optional(),
  })
  .superRefine((value, ctx) => {
    const totalRefs =
      (value.ai_style_reference_asset_ids?.length ?? 0) +
      (value.ugc_character_reference_asset_ids?.length ?? 0) +
      (value.product_reference_asset_ids?.length ?? 0);
    if (totalRefs > MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Use at most ${MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS} total reference images across style, character, and product.`,
        path: ["product_reference_asset_ids"],
      });
    }
  });
