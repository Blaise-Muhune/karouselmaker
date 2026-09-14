"use server";

import { query, queryMany, queryOne } from "./pg";
import type { Project, ProjectInsert, ProjectUpdate } from "./types";

export type WorkspaceProject = Project & {
  carousel_count: number;
  latest_carousel_id: string | null;
  latest_carousel_title: string | null;
  latest_carousel_status: string | null;
  latest_carousel_updated_at: string | null;
};

export async function countProjects(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from projects where user_id = $1`,
    [userId]
  );
  return Number(row?.count ?? 0);
}

export async function listProjects(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<Project[]> {
  if (options?.limit != null) {
    const offset = options.offset ?? 0;
    return queryMany<Project>(
      `select * from projects where user_id = $1
       order by updated_at desc
       limit $2 offset $3`,
      [userId, options.limit, offset]
    );
  }
  return queryMany<Project>(
    `select * from projects where user_id = $1 order by updated_at desc`,
    [userId]
  );
}

/** Projects enriched for the creator workspace without N+1 carousel queries. */
export async function listWorkspaceProjects(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<WorkspaceProject[]> {
  const limit = options?.limit ?? 15;
  const offset = options?.offset ?? 0;
  return queryMany<WorkspaceProject>(
    `select p.*,
       coalesce(stats.carousel_count, 0)::int as carousel_count,
       latest.id as latest_carousel_id,
       latest.title as latest_carousel_title,
       latest.status as latest_carousel_status,
       latest.updated_at as latest_carousel_updated_at
     from projects p
     left join lateral (
       select count(*)::int as carousel_count
       from carousels c
       where c.project_id = p.id
     ) stats on true
     left join lateral (
       select c.id, c.title, c.status, c.updated_at
       from carousels c
       where c.project_id = p.id
       order by c.updated_at desc, c.created_at desc
       limit 1
     ) latest on true
     where p.user_id = $1
     order by coalesce(latest.updated_at, p.updated_at) desc, p.created_at desc
     limit $2 offset $3`,
    [userId, limit, offset]
  );
}

export async function getProject(
  userId: string,
  projectId: string
): Promise<Project | null> {
  return queryOne<Project>(
    `select * from projects where id = $1 and user_id = $2`,
    [projectId, userId]
  );
}

export async function createProject(
  userId: string,
  payload: ProjectInsert
): Promise<Project> {
  const row = await queryOne<Project>(
    `insert into projects (
       user_id, name, niche, content_focus, ugc_character_brief,
       ugc_character_avatar_asset_id, ugc_character_avatar_asset_ids,
       use_saved_ugc_character, tone_preset, language, project_rules,
       slide_structure, brand_kit, sources, post_to_platforms,
       topic_suggestions_cache, ai_style_reference_asset_ids
     ) values (
       $1, $2, $3, coalesce($4, 'general'), $5,
       $6, coalesce($7, '{}'::uuid[]),
       coalesce($8, true), coalesce($9, 'neutral'), coalesce($10, 'en'),
       coalesce($11::jsonb, '{}'::jsonb),
       coalesce($12::jsonb, '{}'::jsonb),
       coalesce($13::jsonb, '{}'::jsonb),
       coalesce($14::jsonb, '{}'::jsonb),
       coalesce($15::jsonb, '{}'::jsonb),
       $16::jsonb,
       coalesce($17, '{}'::uuid[])
     )
     returning *`,
    [
      userId,
      payload.name,
      payload.niche ?? null,
      payload.content_focus ?? null,
      payload.ugc_character_brief ?? null,
      payload.ugc_character_avatar_asset_id ?? null,
      payload.ugc_character_avatar_asset_ids ?? null,
      payload.use_saved_ugc_character ?? null,
      payload.tone_preset ?? null,
      payload.language ?? null,
      payload.project_rules != null ? JSON.stringify(payload.project_rules) : null,
      payload.slide_structure != null ? JSON.stringify(payload.slide_structure) : null,
      payload.brand_kit != null ? JSON.stringify(payload.brand_kit) : null,
      payload.sources != null ? JSON.stringify(payload.sources) : null,
      payload.post_to_platforms != null ? JSON.stringify(payload.post_to_platforms) : null,
      payload.topic_suggestions_cache != null
        ? JSON.stringify(payload.topic_suggestions_cache)
        : null,
      payload.ai_style_reference_asset_ids ?? null,
    ]
  );
  if (!row) throw new Error("Failed to create project");
  return row;
}

export async function updateProject(
  userId: string,
  projectId: string,
  payload: ProjectUpdate
): Promise<Project> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [projectId, userId];
  const add = (col: string, value: unknown, json = false) => {
    params.push(json && value != null ? JSON.stringify(value) : value);
    sets.push(`${col} = $${params.length}${json ? "::jsonb" : ""}`);
  };

  if (payload.name !== undefined) add("name", payload.name);
  if (payload.niche !== undefined) add("niche", payload.niche);
  if (payload.content_focus !== undefined) add("content_focus", payload.content_focus);
  if (payload.ugc_character_brief !== undefined)
    add("ugc_character_brief", payload.ugc_character_brief);
  if (payload.ugc_character_avatar_asset_id !== undefined)
    add("ugc_character_avatar_asset_id", payload.ugc_character_avatar_asset_id);
  if (payload.ugc_character_avatar_asset_ids !== undefined)
    add("ugc_character_avatar_asset_ids", payload.ugc_character_avatar_asset_ids);
  if (payload.use_saved_ugc_character !== undefined)
    add("use_saved_ugc_character", payload.use_saved_ugc_character);
  if (payload.tone_preset !== undefined) add("tone_preset", payload.tone_preset);
  if (payload.language !== undefined) add("language", payload.language);
  if (payload.project_rules !== undefined) add("project_rules", payload.project_rules, true);
  if (payload.slide_structure !== undefined)
    add("slide_structure", payload.slide_structure, true);
  if (payload.brand_kit !== undefined) add("brand_kit", payload.brand_kit, true);
  if (payload.sources !== undefined) add("sources", payload.sources, true);
  if (payload.post_to_platforms !== undefined)
    add("post_to_platforms", payload.post_to_platforms, true);
  if (payload.topic_suggestions_cache !== undefined)
    add("topic_suggestions_cache", payload.topic_suggestions_cache, true);
  if (payload.ai_style_reference_asset_ids !== undefined)
    add("ai_style_reference_asset_ids", payload.ai_style_reference_asset_ids);

  const row = await queryOne<Project>(
    `update projects set ${sets.join(", ")} where id = $1 and user_id = $2 returning *`,
    params
  );
  if (!row) throw new Error("Project not found");
  return row;
}

export async function deleteProject(
  userId: string,
  projectId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await query(`delete from projects where id = $1 and user_id = $2`, [
      projectId,
      userId,
    ]);
    if (res.rowCount === 0) return { ok: false, error: "Project not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}
