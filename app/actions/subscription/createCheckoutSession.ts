"use server";

import Stripe from "stripe";
import { getUser } from "@/lib/server/auth/getUser";
import { getProfile, upsertProfile } from "@/lib/server/db/profiles";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function createCheckoutSession(): Promise<
  { url: string } | { error: string }
> {
  const { user } = await getUser();
  if (!STRIPE_SECRET || !STRIPE_PRICE_ID) {
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
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${APP_URL}/projects?subscription=success`,
    cancel_url: `${APP_URL}/projects?subscription=cancelled`,
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
  });

  const url = session.url;
  if (!url) return { error: "Failed to create checkout session" };
  return { url };
}
