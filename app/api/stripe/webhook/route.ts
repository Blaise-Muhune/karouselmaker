import { NextResponse } from "next/server";
import Stripe from "stripe";
import { grantPostPackCreditsForCheckout, upsertProfileAsAdmin } from "@/lib/server/db/profiles";
import { planFromStripeSubscription } from "@/lib/server/stripe/planFromStripeSubscription";
import { POST_PACK_SIZE } from "@/lib/constants";
import { postPackEmail, subscriptionActivatedEmail } from "@/lib/server/email/messages";
import { sendTransactionalEmail } from "@/lib/server/email/transactional";

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
        const customerEmail = session.customer_details?.email ?? session.customer_email ?? undefined;
        if (session.mode === "payment" && session.metadata?.kind === "post_pack") {
          if (!userId || session.payment_status !== "paid") break;
          const requestedCredits = Number(session.metadata.credits);
          const credits = Number.isInteger(requestedCredits) && requestedCredits > 0
            ? requestedCredits
            : POST_PACK_SIZE;
          const fulfilled = await grantPostPackCreditsForCheckout(userId, session.id, credits);
          if (fulfilled && customerEmail) {
            const message = postPackEmail(credits);
            const result = await sendTransactionalEmail({ to: customerEmail, ...message, idempotencyKey: `post-pack:${session.id}` });
            if (!result.sent) console.error("Post-pack email error:", result.reason);
          }
          break;
        }
        const subscriptionId = subscriptionIdFromCheckoutSession(session);
        if (!userId || !subscriptionId) break;
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = planFromStripeSubscription(sub);
        await upsertProfileAsAdmin(userId, {
          plan,
          stripe_subscription_id: sub.id,
        });
        if (customerEmail && (plan === "creator" || plan === "growth")) {
          const message = subscriptionActivatedEmail(plan);
          const result = await sendTransactionalEmail({ to: customerEmail, ...message, idempotencyKey: `subscription:${session.id}` });
          if (!result.sent) console.error("Subscription email error:", result.reason);
        }
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
