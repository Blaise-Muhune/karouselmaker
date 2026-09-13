import type { PaidPlan } from "@/lib/server/db/types";

export const PAID_PLAN_ORDER: readonly PaidPlan[] = ["creator", "growth"];
export type BillingInterval = "monthly" | "yearly";

export function stripePriceIdForPaidPlan(plan: PaidPlan, interval: BillingInterval = "monthly"): string | undefined {
  const raw =
    interval === "yearly"
      ? plan === "creator"
        ? process.env.STRIPE_SUBSCRIPTION_CREATOR_YEARLY_PRICE_ID
        : process.env.STRIPE_SUBSCRIPTION_GROWTH_YEARLY_PRICE_ID
      : plan === "creator"
        ? process.env.STRIPE_SUBSCRIPTION_CREATOR_MONTHLY_PRICE_ID
        : process.env.STRIPE_SUBSCRIPTION_GROWTH_MONTHLY_PRICE_ID;
  const t = raw?.trim();
  return t || undefined;
}

export function stripePostPackPriceId(): string | undefined {
  return process.env.STRIPE_POST_PACK_PRICE_ID?.trim() || undefined;
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
