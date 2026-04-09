"use server";

import Stripe from "stripe";
import { z } from "zod";
import { getUser } from "@/lib/server/auth/getUser";
import { getProfile, upsertProfile } from "@/lib/server/db/profiles";
import type { PaidPlan } from "@/lib/server/db/types";
import { stripePriceIdForPaidPlan } from "@/lib/server/stripe/paidPlanFromPriceId";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const tierSchema = z.enum(["starter", "pro", "studio"]);

export async function createCheckoutSession(
  tier: PaidPlan = "pro"
): Promise<{ url: string } | { error: string }> {
  const { user } = await getUser();
  const parsedTier = tierSchema.safeParse(tier);
  const plan = parsedTier.success ? parsedTier.data : "pro";
  const priceId = stripePriceIdForPaidPlan(plan);

  if (!STRIPE_SECRET || !priceId) {
    return { error: "Stripe is not configured" };
  }

  const stripe = new Stripe(STRIPE_SECRET);
  const profile = await getProfile(user.id);
  let customerId = profile?.stripe_customer_id;

  const createOrGetCustomer = async (): Promise<string> => {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    await upsertProfile(user.id, { stripe_customer_id: customer.id });
    return customer.id;
  };

  if (!customerId) {
    customerId = await createOrGetCustomer();
  } else {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code === "resource_missing") {
        customerId = await createOrGetCustomer();
      } else {
        throw e;
      }
    }
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/projects?subscription=success`,
    cancel_url: `${APP_URL}/projects?subscription=cancelled`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id, plan } },
  });

  const url = session.url;
  if (!url) return { error: "Failed to create checkout session" };
  return { url };
}
