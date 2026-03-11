import { z } from "zod";

const tonePresetEnum = z.enum([
  "neutral",
  "funny",
  "serious",
  "savage",
  "inspirational",
]);

export const projectRulesSchema = z.object({
  rules: z.string().optional().default(""),
});

export const slideStructureSchema = z.object({
  number_of_slides: z.number().int().min(1).max(20).default(8),
});

const hexColor = z
  .string()
  .optional()
  .default("")
  .refine((v) => !v || /^#[0-9A-Fa-f]{6}$/.test(v), "Must be a hex color (e.g. #000000)");

export const brandKitSchema = z.object({
  primary_color: hexColor,
  secondary_color: hexColor,
  watermark_text: z.string().optional().default(""),
  logo_storage_path: z.string().optional().default(""),
});

const languageCode = z.string().min(1).max(10).default("en");

export const postToPlatformsSchema = z.object({
  facebook: z.boolean().optional().default(false),
  tiktok: z.boolean().optional().default(false),
  instagram: z.boolean().optional().default(false),
  linkedin: z.boolean().optional().default(false),
  youtube: z.boolean().optional().default(false),
});

export const projectFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  niche: z.string().max(200).optional().default(""),
  tone_preset: tonePresetEnum.default("neutral"),
  language: languageCode,
  slide_structure: slideStructureSchema.default({ number_of_slides: 8 }),
  project_rules: projectRulesSchema.default({ rules: "" }),
  brand_kit: brandKitSchema.default({
    primary_color: "",
    secondary_color: "",
    watermark_text: "",
    logo_storage_path: "",
  }),
  post_to_platforms: postToPlatformsSchema.default({
    facebook: false,
    tiktok: false,
    instagram: false,
    linkedin: false,
    youtube: false,
  }),
});

export type ProjectFormInput = z.output<typeof projectFormSchema>;

export function projectFormToDbPayload(
  input: ProjectFormInput
): {
  name: string;
  niche: string | null;
  tone_preset: string;
  language: string;
  project_rules: Record<string, unknown>;
  slide_structure: Record<string, unknown>;
  brand_kit: Record<string, unknown>;
  sources: Record<string, unknown>;
  post_to_platforms: Record<string, boolean>;
} {
  const p = input.post_to_platforms ?? {};
  return {
    name: input.name.trim(),
    niche: input.niche?.trim() || null,
    tone_preset: input.tone_preset,
    language: input.language ?? "en",
    project_rules: {
      rules: input.project_rules.rules ?? "",
    },
    slide_structure: {
      number_of_slides: input.slide_structure.number_of_slides,
    },
    brand_kit: {
      primary_color: input.brand_kit.primary_color ?? "",
      secondary_color: input.brand_kit.secondary_color ?? "",
      watermark_text: input.brand_kit.watermark_text ?? "",
      logo_storage_path: input.brand_kit.logo_storage_path ?? "",
    },
    sources: {},
    post_to_platforms: {
      facebook: !!p.facebook,
      tiktok: !!p.tiktok,
      instagram: !!p.instagram,
      linkedin: !!p.linkedin,
      youtube: !!p.youtube,
    },
  };
}
