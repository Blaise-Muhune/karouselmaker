import type { PaidPlan } from "@/lib/server/db/types";

export const PAID_PLAN_ORDER: readonly PaidPlan[] = ["starter", "pro", "studio"];
export type BillingInterval = "monthly" | "yearly";

export function stripePriceIdForPaidPlan(plan: PaidPlan, interval: BillingInterval = "monthly"): string | undefined {
  const raw =
    interval === "yearly"
      ? plan === "starter"
        ? process.env.STRIPE_SUBSCRIPTION_STARTER_YEARLY_PRICE_ID
        : plan === "pro"
          ? process.env.STRIPE_SUBSCRIPTION_PRO_YEARLY_PRICE_ID
          : process.env.STRIPE_SUBSCRIPTION_STUDIO_YEARLY_PRICE_ID
      : plan === "starter"
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
    if (stripePriceIdForPaidPlan(p, "monthly") === priceId) return p;
    if (stripePriceIdForPaidPlan(p, "yearly") === priceId) return p;
  }
  return null;
}
