/** Pro plan price (display only). Actual price is configured in Stripe. */
export const PRO_PRICE_DISPLAY = "$15.99";

/**
 * Free users get this many carousels (lifetime count) with the same product access as Pro:
 * AI backgrounds, web search, AI image generate (within monthly beta cap), templates, export, editor, and Pro quotas.
 * Admin-only features stay admin-only. After this count, plan reverts to free limits and feature gates.
 */
export const FREE_FULL_ACCESS_GENERATIONS = 3;

/** Pro users can use AI-generated images for this many carousels per month (beta). Free users cannot use it. */
export const AI_GENERATE_LIMIT_PRO = 2;

/** Tester account: 500 carousel generations, double pro limits for assets/exports/templates. */
export const TESTER_EMAIL = "muyumba@andrews.edu";

/** Plan limits */
export const PLAN_LIMITS = {
  free: {
    assets: 5,
    carouselsPerMonth: 5,
    exportsPerMonth: 5,
    customTemplates: 1,
  },
  pro: {
    assets: 100,
    carouselsPerMonth: 50,
    exportsPerMonth: 100,
    customTemplates: 10,
  },
  /** Tester: 500 carousels, 2× pro for assets, exports, custom templates */
  tester: {
    assets: 200,
    carouselsPerMonth: 500,
    exportsPerMonth: 200,
    customTemplates: 20,
  },
} as const;
