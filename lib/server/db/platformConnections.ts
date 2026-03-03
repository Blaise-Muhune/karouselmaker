"use server";

import { createClient } from "@/lib/supabase/server";
import type { PlatformConnection, PlatformConnectionInsert, PlatformName } from "./types";

export async function getPlatformConnections(userId: string): Promise<PlatformConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("user_id", userId)
    .order("platform");

  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformConnection[];
}

export async function getPlatformConnection(
  userId: string,
  platform: PlatformName
): Promise<PlatformConnection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as PlatformConnection;
}

export async function upsertPlatformConnection(
  userId: string,
  payload: Omit<PlatformConnectionInsert, "user_id">
): Promise<PlatformConnection> {
  const supabase = await createClient();
  const row = {
    ...payload,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("platform_connections")
    .upsert(row, { onConflict: "user_id,platform" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PlatformConnection;
}

export async function deletePlatformConnection(
  userId: string,
  platform: PlatformName
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_connections")
    .delete()
    .eq("user_id", userId)
    .eq("platform", platform);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
