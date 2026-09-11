"use server";

import { query, queryMany, queryOne } from "./pg";
import type { Template, TemplateInsert } from "./types";

export async function listTemplatesForUser(
  userId: string,
  options: { includeSystem?: boolean } = {}
): Promise<Template[]> {
  if (options.includeSystem) {
    return queryMany<Template>(
      `select * from templates
       where user_id = $1 or user_id is null
       order by name asc`,
      [userId]
    );
  }
  return queryMany<Template>(
    `select * from templates where user_id = $1 order by name asc`,
    [userId]
  );
}

/** Template ids this user has favorited (system or own). */
export async function listFavoriteTemplateIds(userId: string): Promise<string[]> {
  const rows = await queryMany<{ template_id: string }>(
    `select template_id from user_template_favorites
     where user_id = $1
     order by created_at desc`,
    [userId]
  );
  return rows.map((r) => r.template_id);
}

export async function isTemplateFavorite(userId: string, templateId: string): Promise<boolean> {
  const row = await queryOne<{ template_id: string }>(
    `select template_id from user_template_favorites
     where user_id = $1 and template_id = $2
     limit 1`,
    [userId, templateId]
  );
  return !!row;
}

/** Toggle favorite. Returns the new favorited state. */
export async function toggleTemplateFavorite(
  userId: string,
  templateId: string
): Promise<{ ok: true; is_favorite: boolean } | { ok: false; error: string }> {
  const tpl = await getTemplate(userId, templateId);
  if (!tpl) return { ok: false, error: "Template not found" };

  const existing = await isTemplateFavorite(userId, templateId);
  if (existing) {
    await query(
      `delete from user_template_favorites where user_id = $1 and template_id = $2`,
      [userId, templateId]
    );
    return { ok: true, is_favorite: false };
  }
  await query(
    `insert into user_template_favorites (user_id, template_id)
     values ($1, $2)
     on conflict (user_id, template_id) do nothing`,
    [userId, templateId]
  );
  return { ok: true, is_favorite: true };
}

/**
 * Favorited templates the user can access, newest favorite first.
 */
export async function listFavoriteTemplatesForUser(userId: string): Promise<Template[]> {
  return queryMany<Template>(
    `select t.*
     from user_template_favorites f
     join templates t on t.id = f.template_id
     where f.user_id = $1
       and (t.user_id = $1 or t.user_id is null)
     order by f.created_at desc`,
    [userId]
  );
}

function pickFavoriteDefault(
  favorites: Template[],
  options?: { requireAllowImage?: boolean }
): { templateId: string; isFollowCta: boolean } | null {
  if (favorites.length === 0) return null;
  const allowImage = (t: Template) => {
    const cfg = t.config as { backgroundRules?: { allowImage?: boolean } } | null;
    return cfg?.backgroundRules?.allowImage !== false;
  };
  const pool = options?.requireAllowImage ? favorites.filter(allowImage) : favorites;
  const chosen = (pool.length > 0 ? pool : favorites)[0];
  if (!chosen) return null;
  return {
    templateId: chosen.id,
    isFollowCta: chosen.user_id === null && chosen.name === "Follow CTA",
  };
}

export async function getTemplate(
  userId: string,
  templateId: string
): Promise<Template | null> {
  return queryOne<Template>(
    `select * from templates
     where id = $1 and (user_id = $2 or user_id is null)`,
    [templateId, userId]
  );
}

/**
 * Default template for new carousels without images:
 * favorited template first, else first user template, else "Follow CTA", else any.
 */
export async function getDefaultTemplateForNewCarousel(userId: string): Promise<{
  templateId: string;
  isFollowCta: boolean;
} | null> {
  const favorites = await listFavoriteTemplatesForUser(userId);
  const fromFav = pickFavoriteDefault(favorites);
  if (fromFav) return fromFav;

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

/**
 * Default template for image carousels: prefers favorites that allow images, then allowImage templates.
 */
export async function getDefaultTemplateForNewCarouselImage(userId: string): Promise<{
  templateId: string;
  isFollowCta: boolean;
} | null> {
  const favorites = await listFavoriteTemplatesForUser(userId);
  const fromFav = pickFavoriteDefault(favorites, { requireAllowImage: true });
  if (fromFav) return fromFav;

  const allTemplates = await listTemplatesForUser(userId, { includeSystem: true });
  const allowImage = (t: Template) => {
    const cfg = t.config as { backgroundRules?: { allowImage?: boolean } } | null;
    return cfg?.backgroundRules?.allowImage !== false;
  };
  const userFirst = allTemplates.filter((t) => t.user_id != null);
  const systemOnly = allTemplates.filter((t) => t.user_id == null);
  const chosen =
    userFirst.find(allowImage) ??
    systemOnly.find(allowImage) ??
    userFirst[0] ??
    systemOnly[0];
  if (chosen) {
    const followCta = chosen.user_id === null && chosen.name === "Follow CTA";
    return { templateId: chosen.id, isFollowCta: followCta };
  }
  return getDefaultTemplateForNewCarousel(userId);
}

export async function getDefaultTemplateId(userId: string): Promise<string | null> {
  const def = await getDefaultTemplateForNewCarousel(userId);
  return def?.templateId ?? null;
}

const DEFAULT_LINKEDIN_TEMPLATE_NAME = "LinkedIn Tech";

export async function getDefaultLinkedInTemplate(userId: string): Promise<{
  templateId: string;
} | null> {
  const all = await listTemplatesForUser(userId, { includeSystem: true });
  const linkedin = all.filter((t) => t.category.toLowerCase() === "linkedin");
  const preferred = linkedin.find((t) => t.name === DEFAULT_LINKEDIN_TEMPLATE_NAME);
  const chosen = preferred ?? linkedin[0];
  if (chosen) return { templateId: chosen.id };
  return null;
}

export async function countUserTemplates(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from templates where user_id = $1`,
    [userId]
  );
  return Number(row?.count ?? 0);
}

export async function createTemplate(
  userId: string,
  payload: TemplateInsert
): Promise<Template> {
  const row = await queryOne<Template>(
    `insert into templates (user_id, name, category, aspect_ratio, config, is_locked)
     values ($1, $2, $3, coalesce($4, '1:1'), $5::jsonb, coalesce($6, true))
     returning *`,
    [
      userId,
      payload.name,
      payload.category,
      payload.aspect_ratio ?? null,
      JSON.stringify(payload.config),
      payload.is_locked ?? null,
    ]
  );
  if (!row) throw new Error("Failed to create template");
  return row;
}

/** Create a system template (user_id = null). Admin only. */
export async function createSystemTemplate(
  payload: Omit<TemplateInsert, "user_id">
): Promise<Template> {
  const row = await queryOne<Template>(
    `insert into templates (user_id, name, category, aspect_ratio, config, is_locked)
     values (null, $1, $2, coalesce($3, '1:1'), $4::jsonb, coalesce($5, true))
     returning *`,
    [
      payload.name,
      payload.category,
      payload.aspect_ratio ?? null,
      JSON.stringify(payload.config),
      payload.is_locked ?? null,
    ]
  );
  if (!row) throw new Error("Failed to create system template");
  return row;
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  payload: { name?: string; category?: string; aspect_ratio?: string; config?: unknown }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [templateId, userId];
    const add = (col: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (payload.name !== undefined) add("name", payload.name);
    if (payload.category !== undefined) add("category", payload.category);
    if (payload.aspect_ratio !== undefined) add("aspect_ratio", payload.aspect_ratio);
    if (payload.config !== undefined)
      add("config", JSON.stringify(payload.config), "::jsonb");

    const res = await query(
      `update templates set ${sets.join(", ")} where id = $1 and user_id = $2`,
      params
    );
    if (res.rowCount === 0) return { ok: false, error: "Template not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function updateTemplateAsAdmin(
  templateId: string,
  payload: {
    name?: string;
    category?: string;
    aspect_ratio?: string;
    config?: unknown;
    user_id?: string | null;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [templateId];
    const add = (col: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };
    if (payload.name !== undefined) add("name", payload.name);
    if (payload.category !== undefined) add("category", payload.category);
    if (payload.aspect_ratio !== undefined) add("aspect_ratio", payload.aspect_ratio);
    if (payload.config !== undefined)
      add("config", JSON.stringify(payload.config), "::jsonb");
    if (payload.user_id !== undefined) add("user_id", payload.user_id);

    const res = await query(
      `update templates set ${sets.join(", ")} where id = $1`,
      params
    );
    if (res.rowCount === 0) return { ok: false, error: "Template not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Update failed" };
  }
}

export async function deleteTemplate(
  userId: string,
  templateId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await query(`delete from templates where id = $1 and user_id = $2`, [
      templateId,
      userId,
    ]);
    if (res.rowCount === 0) return { ok: false, error: "Template not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}

export async function deleteTemplateAsAdmin(
  templateId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await query(`delete from templates where id = $1`, [templateId]);
    if (res.rowCount === 0) return { ok: false, error: "Template not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}
