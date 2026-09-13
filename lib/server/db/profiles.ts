"use server";

import { getPool, queryOne } from "./pg";
import type { Plan, Profile } from "./types";

type ProfilePlanPayload = {
  display_name?: string;
  plan?: Plan;
  how_found_us?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  post_pack_credits?: number;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  return queryOne<Profile>(`select * from profiles where user_id = $1`, [userId]);
}

async function upsertProfileRow(
  userId: string,
  payload: ProfilePlanPayload
): Promise<Profile> {
  const existing = await getProfile(userId);
  if (!existing) {
    const row = await queryOne<Profile>(
      `insert into profiles (
         user_id, display_name, plan, how_found_us,
         stripe_customer_id, stripe_subscription_id
       ) values ($1, $2, coalesce($3, 'free'), $4, $5, $6)
       returning *`,
      [
        userId,
        payload.display_name ?? null,
        payload.plan ?? null,
        payload.how_found_us ?? null,
        payload.stripe_customer_id ?? null,
        payload.stripe_subscription_id ?? null,
      ]
    );
    if (!row) throw new Error("Failed to create profile");
    return row;
  }

  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [userId];
  const add = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (payload.display_name !== undefined) add("display_name", payload.display_name);
  if (payload.plan !== undefined) add("plan", payload.plan);
  if (payload.how_found_us !== undefined) add("how_found_us", payload.how_found_us);
  if (payload.stripe_customer_id !== undefined)
    add("stripe_customer_id", payload.stripe_customer_id);
  if (payload.stripe_subscription_id !== undefined)
    add("stripe_subscription_id", payload.stripe_subscription_id);
  if (payload.post_pack_credits !== undefined)
    add("post_pack_credits", payload.post_pack_credits);

  const row = await queryOne<Profile>(
    `update profiles set ${sets.join(", ")} where user_id = $1 returning *`,
    params
  );
  if (!row) throw new Error("Failed to update profile");
  return row;
}

export async function upsertProfile(
  userId: string,
  payload: ProfilePlanPayload
): Promise<Profile> {
  return upsertProfileRow(userId, payload);
}

/**
 * Same as upsertProfile — Azure DB has no RLS; auth is enforced by callers.
 * Kept for webhook/background jobs that previously used the service role.
 */
export async function upsertProfileAsAdmin(
  userId: string,
  payload: ProfilePlanPayload
): Promise<Profile> {
  return upsertProfileRow(userId, payload);
}

/**
 * Atomically record a one-time Stripe Checkout fulfillment and add post packs.
 * Stripe can retry webhook delivery, so the checkout session is the idempotency key.
 */
export async function grantPostPackCreditsForCheckout(
  userId: string,
  checkoutSessionId: string,
  credits: number
): Promise<boolean> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const fulfilled = await client.query<{ stripe_checkout_session_id: string }>(
      `insert into stripe_fulfillments (stripe_checkout_session_id, user_id, kind, quantity)
       values ($1, $2, 'post_pack', $3)
       on conflict (stripe_checkout_session_id) do nothing
       returning stripe_checkout_session_id`,
      [checkoutSessionId, userId, credits]
    );
    if (fulfilled.rowCount === 0) {
      await client.query("commit");
      return false;
    }
    await client.query(
      `insert into profiles (user_id, plan, post_pack_credits)
       values ($1, 'free', $2)
       on conflict (user_id) do update
       set post_pack_credits = profiles.post_pack_credits + excluded.post_pack_credits,
           updated_at = now()`,
      [userId, credits]
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Use one purchased post pack only after the monthly subscription allowance is exhausted. */
export async function consumePostPackCredit(userId: string): Promise<boolean> {
  const row = await queryOne<{ post_pack_credits: number }>(
    `update profiles
     set post_pack_credits = post_pack_credits - 1,
         updated_at = now()
     where user_id = $1 and post_pack_credits > 0
     returning post_pack_credits`,
    [userId]
  );
  return Boolean(row);
}
