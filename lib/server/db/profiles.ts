"use server";

import { queryOne } from "./pg";
import type { Plan, Profile } from "./types";

type ProfilePlanPayload = {
  display_name?: string;
  plan?: Plan;
  how_found_us?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
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
