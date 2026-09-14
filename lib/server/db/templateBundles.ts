"use server";

import { query, queryMany, queryOne } from "./pg";
import type { TemplateBundle } from "./types";

export async function listTemplateBundlesForUser(
  userId: string,
  options: { includeSystem?: boolean; includeHidden?: boolean } = {}
): Promise<TemplateBundle[]> {
  if (options.includeSystem) {
    const hiddenFilter = options.includeHidden ? "" : " and coalesce(is_hidden, false) = false";
    return queryMany<TemplateBundle>(
      `select * from template_bundles
       where user_id = $1 or (user_id is null${hiddenFilter})
       order by user_id nulls first, name asc`,
      [userId]
    );
  }
  return queryMany<TemplateBundle>(
    `select * from template_bundles where user_id = $1 order by name asc`,
    [userId]
  );
}

export async function getTemplateBundle(userId: string, bundleId: string): Promise<TemplateBundle | null> {
  return queryOne<TemplateBundle>(
    `select * from template_bundles where id = $1 and (user_id = $2 or user_id is null)`,
    [bundleId, userId]
  );
}

export async function createTemplateBundle(
  userId: string | null,
  payload: { name: string; template_ids: string[]; is_locked?: boolean }
): Promise<TemplateBundle> {
  const row = await queryOne<TemplateBundle>(
    `insert into template_bundles (user_id, name, template_ids, is_locked)
     values ($1, $2, $3::uuid[], coalesce($4, true)) returning *`,
    [userId, payload.name, payload.template_ids, payload.is_locked ?? null]
  );
  if (!row) throw new Error("Failed to create template bundle");
  return row;
}

export async function updateTemplateBundle(
  userId: string | null,
  bundleId: string,
  payload: { name: string; template_ids: string[] }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await query(
      `update template_bundles
       set name = $3, template_ids = $4::uuid[], updated_at = now()
       where id = $1 and user_id is not distinct from $2`,
      [bundleId, userId, payload.name, payload.template_ids]
    );
    return (result.rowCount ?? 0) > 0 ? { ok: true } : { ok: false, error: "Bundle not found" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Update failed" };
  }
}

export async function deleteTemplateBundle(
  userId: string | null,
  bundleId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await query(
    `delete from template_bundles where id = $1 and user_id is not distinct from $2`,
    [bundleId, userId]
  );
  return (result.rowCount ?? 0) > 0 ? { ok: true } : { ok: false, error: "Bundle not found" };
}
