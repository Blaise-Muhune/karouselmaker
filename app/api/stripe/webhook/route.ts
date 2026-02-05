import { NextResponse } from "next/server";
import Stripe from "stripe";
import { upsertProfileAsAdmin } from "@/lib/server/db/profiles";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!STRIPE_SECRET || !WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(STRIPE_SECRET);
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
        const subscriptionId = session.subscription as string | null;
        if (!userId) break;
        await upsertProfileAsAdmin(userId, {
          plan: "pro",
          stripe_subscription_id: subscriptionId,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        const status = sub.status;
        // active, trialing: full access. past_due: payment retrying, keep access. canceled + period_end: keep until end.
        const isActive =
          status === "active" ||
          status === "trialing" ||
          status === "past_due" ||
          (status === "canceled" && sub.cancel_at_period_end);
        await upsertProfileAsAdmin(userId, {
          plan: isActive ? "pro" : "free",
          stripe_subscription_id: isActive ? sub.id : null,
        });
        break;
      }
      default:
        // Ignore unhandled events
        break;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook handler failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
