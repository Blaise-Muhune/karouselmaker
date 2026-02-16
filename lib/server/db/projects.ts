"use server";

import { createClient } from "@/lib/supabase/server";
import type { Project, ProjectInsert, ProjectUpdate } from "./types";

export async function countProjects(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

export async function listProjects(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<Project[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options?.limit != null) {
    const offset = options.offset ?? 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function getProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Project;
}

export async function createProject(
  userId: string,
  payload: ProjectInsert
): Promise<Project> {
  const supabase = await createClient();
  const row = { ...payload, user_id: userId };
  const { data, error } = await supabase.from("projects").insert(row).select().single();

  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(
  userId: string,
  projectId: string,
  payload: ProjectUpdate
): Promise<Project> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
