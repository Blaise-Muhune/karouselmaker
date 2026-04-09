import type Stripe from "stripe";
import type { Plan } from "@/lib/server/db/types";
import { paidPlanFromStripePriceId } from "@/lib/server/stripe/paidPlanFromPriceId";

/** Resolve DB plan from the first subscription item's price id. Unknown → pro (legacy). */
export function planFromStripeSubscription(sub: Stripe.Subscription): Plan {
  const priceId = sub.items.data[0]?.price?.id;
  const paid = paidPlanFromStripePriceId(priceId);
  if (paid) return paid;
  return "pro";
}
