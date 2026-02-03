import { z } from "zod";

const tonePresetEnum = z.enum([
  "neutral",
  "funny",
  "serious",
  "savage",
  "inspirational",
]);

export const voiceRulesSchema = z.object({
  do_rules: z.string().optional().default(""),
  dont_rules: z.string().optional().default(""),
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
});

export const projectFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  niche: z.string().max(200).optional().default(""),
  tone_preset: tonePresetEnum.default("neutral"),
  slide_structure: slideStructureSchema.default({ number_of_slides: 8 }),
  voice_rules: voiceRulesSchema.default({ do_rules: "", dont_rules: "" }),
  brand_kit: brandKitSchema.default({
    primary_color: "",
    secondary_color: "",
    watermark_text: "",
  }),
});

export type ProjectFormInput = z.output<typeof projectFormSchema>;

export function projectFormToDbPayload(
  input: ProjectFormInput
): {
  name: string;
  niche: string | null;
  tone_preset: string;
  voice_rules: Record<string, unknown>;
  slide_structure: Record<string, unknown>;
  brand_kit: Record<string, unknown>;
  sources: Record<string, unknown>;
} {
  return {
    name: input.name.trim(),
    niche: input.niche?.trim() || null,
    tone_preset: input.tone_preset,
    voice_rules: {
      do_rules: input.voice_rules.do_rules ?? "",
      dont_rules: input.voice_rules.dont_rules ?? "",
    },
    slide_structure: {
      number_of_slides: input.slide_structure.number_of_slides,
    },
    brand_kit: {
      primary_color: input.brand_kit.primary_color ?? "",
      secondary_color: input.brand_kit.secondary_color ?? "",
      watermark_text: input.brand_kit.watermark_text ?? "",
    },
    sources: {},
  };
}
