import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertProfileAsAdmin } from "@/lib/server/db/profiles";
import { planFromStripeSubscription } from "@/lib/server/stripe/planFromStripeSubscription";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function subscriptionIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const sub = session.subscription;
  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "deleted" in sub && sub.deleted) return null;
  if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  return null;
}

export async function POST(request: Request) {
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(STRIPE_SECRET);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = subscriptionIdFromCheckoutSession(session);
        if (!userId || !subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = planFromStripeSubscription(sub);
        await upsertProfileAsAdmin(userId, {
          plan,
          stripe_subscription_id: sub.id,
        });
        break;
      }
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const status = sub.status;
        const isActive =
          status === "active" ||
          status === "trialing" ||
          status === "past_due" ||
          (status === "canceled" && sub.cancel_at_period_end);
        if (isActive) {
          await upsertProfileAsAdmin(userId, {
            plan: planFromStripeSubscription(sub),
            stripe_subscription_id: sub.id,
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const status = sub.status;
        const isActive =
          status === "active" ||
          status === "trialing" ||
          status === "past_due" ||
          (status === "canceled" && sub.cancel_at_period_end);
        await upsertProfileAsAdmin(userId, {
          plan: isActive ? planFromStripeSubscription(sub) : "free",
          stripe_subscription_id: isActive ? sub.id : null,
        });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook handler failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
