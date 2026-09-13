import { z } from "zod";
import { PRODUCT_TO_PROMOTE_MAX_CHARS, PROJECT_RULES_MAX_CHARS } from "@/lib/constants";
import {
  clampOrganicMarketingProgress,
  ORGANIC_MARKETING_PROGRESS_MAX,
  ORGANIC_MARKETING_PROGRESS_MIN,
} from "@/lib/organicMarketingProgress";

const tonePresetEnum = z.enum([
  "neutral",
  "funny",
  "serious",
  "savage",
  "inspirational",
]);

export const projectRulesSchema = z.object({
  rules: z.string().max(PROJECT_RULES_MAX_CHARS).optional().default(""),
  /** What product/page/offer to soft-promote — URL and/or short description. */
  product_to_promote: z.string().max(PRODUCT_TO_PROMOTE_MAX_CHARS).optional().default(""),
  /**
   * 0–10: how much organic marketing this account has already done.
   * Low = progressive value-first posts; high = more marketing carousels OK.
   */
  organic_marketing_progress: z
    .number()
    .int()
    .min(ORGANIC_MARKETING_PROGRESS_MIN)
    .max(ORGANIC_MARKETING_PROGRESS_MAX)
    .optional()
    .default(0),
});

export type ParsedProjectRules = {
  rules: string;
  product_to_promote: string;
  product_url: string | null;
  product_brief: string;
  organic_marketing_progress: number;
  /** Promised next topic from a prior CTA / similar_ideas[0]. */
  pending_open_loop: string | null;
  /** Count of completed marketing-mode carousel generations (for auto progress). */
  marketing_carousels_completed: number;
};

export const slideStructureSchema = z.object({
  number_of_slides: z.number().int().min(3).max(7).default(5),
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

export const projectFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  niche: z.string().max(200).optional().default(""),
  tone_preset: tonePresetEnum.default("neutral"),
  language: languageCode,
  slide_structure: slideStructureSchema.default({ number_of_slides: 5 }),
  project_rules: projectRulesSchema.default({
    rules: "",
    product_to_promote: "",
    organic_marketing_progress: 0,
  }),
  brand_kit: brandKitSchema.default({
    primary_color: "",
    secondary_color: "",
    watermark_text: "",
    logo_storage_path: "",
  }),
});

export type ProjectFormInput = z.output<typeof projectFormSchema>;

/** Read product fields from project_rules JSON (and legacy do/dont rules for display). */
export function parseProjectRulesJson(projectRules: unknown): ParsedProjectRules {
  const json = projectRules as
    | {
        rules?: string;
        product_to_promote?: string;
        product_url?: string | null;
        product_brief?: string;
        organic_marketing_progress?: unknown;
        pending_open_loop?: unknown;
        marketing_carousels_completed?: unknown;
        do_rules?: string;
        dont_rules?: string;
      }
    | undefined;
  const rulesValue =
    json?.rules?.trim() ||
    (json?.do_rules || json?.dont_rules
      ? [json?.do_rules && `Do: ${json.do_rules}`, json?.dont_rules && `Don't: ${json.dont_rules}`]
          .filter(Boolean)
          .join("\n\n")
      : "");
  const pending =
    typeof json?.pending_open_loop === "string" && json.pending_open_loop.trim()
      ? json.pending_open_loop.trim().slice(0, 200)
      : null;
  const marketingCompletedRaw = json?.marketing_carousels_completed;
  const marketingCompleted =
    typeof marketingCompletedRaw === "number" && Number.isFinite(marketingCompletedRaw)
      ? Math.max(0, Math.floor(marketingCompletedRaw))
      : typeof marketingCompletedRaw === "string" && Number.isFinite(Number(marketingCompletedRaw))
        ? Math.max(0, Math.floor(Number(marketingCompletedRaw)))
        : 0;
  return {
    rules: rulesValue,
    product_to_promote: typeof json?.product_to_promote === "string" ? json.product_to_promote : "",
    product_url: typeof json?.product_url === "string" && json.product_url.trim() ? json.product_url.trim() : null,
    product_brief: typeof json?.product_brief === "string" ? json.product_brief : "",
    organic_marketing_progress: clampOrganicMarketingProgress(json?.organic_marketing_progress),
    pending_open_loop: pending,
    marketing_carousels_completed: marketingCompleted,
  };
}

export function projectFormToDbPayload(
  input: ProjectFormInput,
  productContext?: {
    product_url?: string | null;
    product_brief?: string;
    /** Preserve QC memory fields not edited in the form. */
    pending_open_loop?: string | null;
    marketing_carousels_completed?: number;
  }
): {
  name: string;
  niche: string | null;
  tone_preset: string;
  language: string;
  project_rules: Record<string, unknown>;
  slide_structure: Record<string, unknown>;
  brand_kit: Record<string, unknown>;
  sources: Record<string, unknown>;
} {
  return {
    name: input.name.trim(),
    niche: input.niche?.trim() || null,
    tone_preset: input.tone_preset,
    language: input.language ?? "en",
    project_rules: {
      rules: input.project_rules.rules ?? "",
      product_to_promote: input.project_rules.product_to_promote ?? "",
      product_url: productContext?.product_url ?? null,
      product_brief: productContext?.product_brief ?? "",
      organic_marketing_progress: clampOrganicMarketingProgress(
        input.project_rules.organic_marketing_progress
      ),
      ...(productContext?.pending_open_loop
        ? { pending_open_loop: productContext.pending_open_loop }
        : {}),
      ...(typeof productContext?.marketing_carousels_completed === "number"
        ? { marketing_carousels_completed: productContext.marketing_carousels_completed }
        : {}),
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
  };
}

