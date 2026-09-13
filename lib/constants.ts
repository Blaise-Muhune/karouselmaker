import type { PaidPlan } from "@/lib/server/db/types";

/** Display prices — must match Stripe Products. */
export const CREATOR_PRICE_DISPLAY = "$19";
export const GROWTH_PRICE_DISPLAY = "$39";
export const POST_PACK_PRICE_DISPLAY = "$12";
export const POST_PACK_SIZE = 10;
export const YEARLY_DISCOUNT_PERCENT = 20;

/** Landing / upgrade copy: ordered paid tiers. */
export const PAID_TIER_CARDS: {
  id: PaidPlan;
  name: string;
  priceDisplay: string;
  blurb: string;
  highlights: string[];
}[] = [
  {
    id: "creator",
    name: "Creator",
    priceDisplay: CREATOR_PRICE_DISPLAY,
    blurb: "For a consistent weekly posting habit.",
    highlights: [
      "20 ready-to-post carousels / month",
      "Captions, hashtags, and stock images",
      "Unlimited editing and downloads",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    priceDisplay: GROWTH_PRICE_DISPLAY,
    blurb: "For brands posting most days of the week.",
    highlights: [
      "60 ready-to-post carousels / month",
      "Captions, hashtags, and stock images",
      "Unlimited editing and downloads",
    ],
  },
];

/**
 * A new account gets this many complete post packs, once.
 */
export const FREE_FULL_ACCESS_GENERATIONS = 3;

/** Project settings: max library images saved as AI style references (schema ceiling; plans may be lower). */
export const MAX_PROJECT_AI_STYLE_REFERENCE_ASSETS = 10;
/** New carousel form: max extra style references for one generation (merged with project; carousel IDs first). */
export const MAX_CAROUSEL_AI_STYLE_REFERENCE_ASSETS = 8;
/** Characters + style + product/service reference images combined (new carousel AI generate). */
export const MAX_CAROUSEL_COMBINED_REFERENCE_ASSETS = 8;
/** Max chars for carousel "Notes" and similar fields (must match `generateCarouselInputSchema`). */
export const CAROUSEL_NOTES_MAX_CHARS = 8000;
/** Max chars for carousel topic/URL/paste input (must match `generateCarouselInputSchema`). */
export const CAROUSEL_INPUT_MAX_CHARS = 20000;
/** Per-slide AI background regeneration: user instruction appended to the image prompt. */
export const SLIDE_AI_REGEN_INSTRUCTION_MAX_CHARS = 500;
/** Max chars for project rules textarea (must match `projectFormSchema`). */
export const PROJECT_RULES_MAX_CHARS = 8000;
/** Max chars for product/page to promote (stored in project_rules JSON). */
export const PRODUCT_TO_PROMOTE_MAX_CHARS = 2000;
/** @deprecated Kept for plan limit shape; AI image gen removed from product. */
export const UGC_CHARACTER_BRIEF_MAX_CHARS = 1200;
/** @deprecated Kept for plan limit shape; UGC removed from product. */
export const MAX_UGC_AVATAR_REFERENCE_ASSETS = 5;
/** Short Instagram carousels: min/max slides per post. */
export const CAROUSEL_SLIDES_MIN = 3;
export const CAROUSEL_SLIDES_MAX = 7;
export const CAROUSEL_SLIDES_DEFAULT = 5;

/** Tester accounts: high limits for internal QA. */
export const TESTER_EMAILS: string[] = ["muyumba@andrews.edu", "prudencemange@gmail.com"];

/** Per-plan quotas. `tester` is not stored on profiles — applied by email in subscription helpers. */
export const PLAN_LIMITS = {
  free: {
    assets: 5,
    carouselsPerMonth: 0,
    exportsPerMonth: 0,
    customTemplates: 1,
    aiGenerateCarouselsPerMonth: 0,
    maxProjectStyleReferenceAssets: 2,
    maxUgcAvatarReferenceAssets: 2,
  },
  creator: {
    assets: 100,
    carouselsPerMonth: 20,
    exportsPerMonth: 0,
    customTemplates: 4,
    aiGenerateCarouselsPerMonth: 0,
    maxProjectStyleReferenceAssets: 5,
    maxUgcAvatarReferenceAssets: 3,
  },
  growth: {
    assets: 250,
    carouselsPerMonth: 60,
    exportsPerMonth: 0,
    customTemplates: 10,
    aiGenerateCarouselsPerMonth: 25,
    maxProjectStyleReferenceAssets: 10,
    maxUgcAvatarReferenceAssets: 5,
  },
  tester: {
    assets: 200,
    carouselsPerMonth: 500,
    exportsPerMonth: 0,
    customTemplates: 20,
    aiGenerateCarouselsPerMonth: 999,
    maxProjectStyleReferenceAssets: 10,
    maxUgcAvatarReferenceAssets: 5,
  },
} as const;

export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
