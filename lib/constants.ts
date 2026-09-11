import type { PaidPlan } from "@/lib/server/db/types";

/** Display prices — must match Stripe Products. */
export const STARTER_PRICE_DISPLAY = "$25";
export const PRO_PRICE_DISPLAY = "$39";
export const STUDIO_PRICE_DISPLAY = "$59";

/** Landing / upgrade copy: ordered paid tiers. */
export const PAID_TIER_CARDS: {
  id: PaidPlan;
  name: string;
  priceDisplay: string;
  blurb: string;
  highlights: string[];
}[] = [
  {
    id: "starter",
    name: "Starter",
    priceDisplay: STARTER_PRICE_DISPLAY,
    blurb: "Solo marketers getting consistent on IG & TikTok.",
    highlights: [
      "25 carousels / month",
      "40 exports / month",
      "40 library images",
      "Web image search",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceDisplay: PRO_PRICE_DISPLAY,
    blurb: "Most popular — weekly organic posting + heavier use.",
    highlights: [
      "50 carousels / month",
      "100 exports / month",
      "100 library images",
      "Web image search",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    priceDisplay: STUDIO_PRICE_DISPLAY,
    blurb: "High-volume organic product marketing (solo).",
    highlights: [
      "100 carousels / month",
      "200 exports / month",
      "200 library images",
      "Web image search",
    ],
  },
];

/**
 * Free users get this many carousels (lifetime count) with Pro-like feature access:
 * web image search, templates, export, editor, and paid-tier quotas.
 * After this count, plan reverts to free limits and feature gates.
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
    carouselsPerMonth: 5,
    exportsPerMonth: 5,
    customTemplates: 1,
    aiGenerateCarouselsPerMonth: 0,
    maxProjectStyleReferenceAssets: 2,
    maxUgcAvatarReferenceAssets: 2,
  },
  starter: {
    assets: 40,
    carouselsPerMonth: 25,
    exportsPerMonth: 40,
    customTemplates: 4,
    aiGenerateCarouselsPerMonth: 10,
    maxProjectStyleReferenceAssets: 5,
    maxUgcAvatarReferenceAssets: 3,
  },
  pro: {
    assets: 100,
    carouselsPerMonth: 50,
    exportsPerMonth: 100,
    customTemplates: 10,
    aiGenerateCarouselsPerMonth: 25,
    maxProjectStyleReferenceAssets: 10,
    maxUgcAvatarReferenceAssets: 5,
  },
  studio: {
    assets: 200,
    carouselsPerMonth: 100,
    exportsPerMonth: 200,
    customTemplates: 20,
    aiGenerateCarouselsPerMonth: 50,
    maxProjectStyleReferenceAssets: 10,
    maxUgcAvatarReferenceAssets: 5,
  },
  tester: {
    assets: 200,
    carouselsPerMonth: 500,
    exportsPerMonth: 200,
    customTemplates: 20,
    aiGenerateCarouselsPerMonth: 999,
    maxProjectStyleReferenceAssets: 10,
    maxUgcAvatarReferenceAssets: 5,
  },
} as const;

export type PlanLimits = (typeof PLAN_LIMITS)[keyof typeof PLAN_LIMITS];
