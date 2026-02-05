"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "./types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Profile;
}

export async function upsertProfile(
  userId: string,
  payload: { display_name?: string; plan?: "free" | "pro"; stripe_customer_id?: string | null; stripe_subscription_id?: string | null }
): Promise<Profile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...payload,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}

/**
 * Upsert profile using service role (bypasses RLS).
 * Use for webhooks/background jobs where there is no user session.
 */
export async function upsertProfileAsAdmin(
  userId: string,
  payload: { display_name?: string; plan?: "free" | "pro"; stripe_customer_id?: string | null; stripe_subscription_id?: string | null }
): Promise<Profile> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...payload,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Profile;
}
