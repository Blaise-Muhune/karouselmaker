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
    blurb: "Solo creators getting consistent on carousels.",
    highlights: [
      "25 carousels / month",
      "40 exports / month",
      "40 library images",
      "10 AI-image carousels / month",
      "4 custom templates",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceDisplay: PRO_PRICE_DISPLAY,
    blurb: "Most popular — weekly posting + heavier AI use.",
    highlights: [
      "50 carousels / month",
      "100 exports / month",
      "100 library images",
      "25 AI-image carousels / month",
      "10 custom templates",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    priceDisplay: STUDIO_PRICE_DISPLAY,
    blurb: "High volume and max AI-image allowance (solo).",
    highlights: [
      "100 carousels / month",
      "200 exports / month",
      "200 library images",
      "50 AI-image carousels / month",
      "20 custom templates",
    ],
  },
];

/**
 * Free users get this many carousels (lifetime count) with the same product access as Pro:
 * AI backgrounds, web search, AI image generate (within monthly cap), templates, export, editor, and paid-tier quotas.
 * Admin-only features stay admin-only. After this count, plan reverts to free limits and feature gates.
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
/** UGC project: saved recurring character / visual lock for AI images (must match `projectFormSchema`). */
export const UGC_CHARACTER_BRIEF_MAX_CHARS = 1200;
/** UGC face/body library refs merged in one vision call (angles of same person) — schema ceiling. */
export const MAX_UGC_AVATAR_REFERENCE_ASSETS = 5;

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
