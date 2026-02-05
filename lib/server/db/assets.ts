import { createClient } from "@/lib/supabase/server";
import type { Asset, AssetInsert } from "./types";

export async function createAsset(
  userId: string,
  payload: Omit<AssetInsert, "user_id"> & { storage_path: string }
): Promise<Asset> {
  const supabase = await createClient();
  const row = { ...payload, user_id: userId };
  const { data, error } = await supabase.from("assets").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data as Asset;
}

export async function getAsset(
  userId: string,
  assetId: string
): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .eq("user_id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Asset;
}

export async function countAssets(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

export async function listAssets(
  userId: string,
  options: { projectId?: string | null; limit?: number } = {}
): Promise<Asset[]> {
  const supabase = await createClient();
  let q = supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (options.projectId !== undefined && options.projectId !== null) {
    q = q.eq("project_id", options.projectId);
  } else if (options.projectId === null) {
    q = q.is("project_id", null);
  }
  q = q.limit(options.limit ?? 100);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Asset[];
}

export async function deleteAsset(
  userId: string,
  assetId: string
): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("assets")
    .select("id")
    .eq("id", assetId)
    .eq("user_id", userId)
    .single();
  if (!row) throw new Error("Asset not found");
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw new Error(error.message);
}
