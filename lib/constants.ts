/** Pro plan price (display only). Actual price is configured in Stripe. */
export const PRO_PRICE_DISPLAY = "$15.99";

/** Plan limits */
export const PLAN_LIMITS = {
  free: {
    assets: 5,
    carouselsPerMonth: 5,
    exportsPerMonth: 2,
    customTemplates: 0,
  },
  pro: {
    assets: 100,
    carouselsPerMonth: 50,
    exportsPerMonth: 100,
    customTemplates: 10,
  },
} as const;
