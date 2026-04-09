import type { PaidPlan } from "@/lib/server/db/types";

export const PAID_PLAN_ORDER: readonly PaidPlan[] = ["starter", "pro", "studio"];

export function stripePriceIdForPaidPlan(plan: PaidPlan): string | undefined {
  const raw =
    plan === "starter"
      ? process.env.STRIPE_SUBSCRIPTION_STARTER_PRICE_ID
      : plan === "pro"
        ? process.env.STRIPE_SUBSCRIPTION_PRO_PRICE_ID
        : process.env.STRIPE_SUBSCRIPTION_STUDIO_PRICE_ID;
  const t = raw?.trim();
  return t || undefined;
}

/** Map Stripe subscription item price id → paid plan. Unknown ids return null. */
export function paidPlanFromStripePriceId(priceId: string | undefined | null): PaidPlan | null {
  if (!priceId) return null;
  for (const p of PAID_PLAN_ORDER) {
    if (stripePriceIdForPaidPlan(p) === priceId) return p;
  }
  return null;
}
