"use server";

import Stripe from "stripe";
import { getUser } from "@/lib/server/auth/getUser";
import { getProfile } from "@/lib/server/db/profiles";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function createCustomerPortalSession(): Promise<
  { url: string } | { error: string }
> {
  const { user } = await getUser();
  if (!STRIPE_SECRET) return { error: "Stripe is not configured" };

  const profile = await getProfile(user.id);
  const customerId = profile?.stripe_customer_id;
  if (!customerId) return { error: "No subscription found" };

  const stripe = new Stripe(STRIPE_SECRET);
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/projects?subscription=updated`,
    });

    if (!session.url) return { error: "Failed to create portal session" };
    return { url: session.url };
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "resource_missing") {
      return { error: "Subscription data is out of date. Please try upgrading again from the projects page." };
    }
    throw e;
  }
}
