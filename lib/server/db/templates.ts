"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Template, TemplateInsert } from "./types";

export async function listTemplatesForUser(
  userId: string,
  options: { includeSystem?: boolean } = {}
): Promise<Template[]> {
  const supabase = await createClient();
  let q = supabase.from("templates").select("*").order("name", { ascending: true });

  if (options.includeSystem) {
    q = q.or(`user_id.eq.${userId},user_id.is.null`);
  } else {
    q = q.eq("user_id", userId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Template[];
  // Deduplicate by (user_id, name) — seed migration can run multiple times
  const seen = new Set<string>();
  return rows.filter((t) => {
    const key = `${t.user_id ?? "null"}:${t.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getTemplate(
  userId: string,
  templateId: string
): Promise<Template | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .or(`user_id.eq.${userId},user_id.is.null`)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Template;
}

/**
 * Default template for new carousels and for slides with no template_id: if the user has any custom
 * template, use the first (by name); otherwise use the system template "Follow CTA".
 */
export async function getDefaultTemplateForNewCarousel(userId: string): Promise<{
  templateId: string;
  isFollowCta: boolean;
} | null> {
  const userTemplates = await listTemplatesForUser(userId, { includeSystem: false });
  if (userTemplates.length > 0) {
    const first = userTemplates[0];
    if (first) return { templateId: first.id, isFollowCta: false };
  }
  const allTemplates = await listTemplatesForUser(userId, { includeSystem: true });
  const followCta = allTemplates.find((t) => t.user_id === null && t.name === "Follow CTA");
  if (followCta) return { templateId: followCta.id, isFollowCta: true };
  const fallback = allTemplates[0];
  if (fallback) return { templateId: fallback.id, isFollowCta: false };
  return null;
}

/** Template ID to use when a slide has template_id null (e.g. export). Same order as above. */
export async function getDefaultTemplateId(userId: string): Promise<string | null> {
  const def = await getDefaultTemplateForNewCarousel(userId);
  return def?.templateId ?? null;
}

export async function countUserTemplates(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("templates")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

export async function createTemplate(
  userId: string,
  payload: TemplateInsert
): Promise<Template> {
  const supabase = await createClient();
  const row = { ...payload, user_id: userId };
  const { data, error } = await supabase.from("templates").insert(row).select().single();

  if (error) throw new Error(error.message);
  return data as Template;
}

/** Create a system template (user_id = null), visible to all users. Admin only; use service role to bypass RLS. */
export async function createSystemTemplate(
  payload: Omit<TemplateInsert, "user_id">
): Promise<Template> {
  const supabase = createAdminClient();
  const row = { ...payload, user_id: null };
  const { data, error } = await supabase.from("templates").insert(row).select().single();

  if (error) throw new Error(error.message);
  return data as Template;
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  payload: { name?: string; category?: string; aspect_ratio?: string; config?: unknown }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplate(
  userId: string,
  templateId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
