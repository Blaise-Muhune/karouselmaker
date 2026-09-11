"use server";

import { query, queryMany, queryOne } from "./pg";
import type { PlatformConnection, PlatformConnectionInsert, PlatformName } from "./types";

export async function getPlatformConnections(userId: string): Promise<PlatformConnection[]> {
  return queryMany<PlatformConnection>(
    `select * from platform_connections where user_id = $1 order by platform`,
    [userId]
  );
}

export async function getPlatformConnection(
  userId: string,
  platform: PlatformName
): Promise<PlatformConnection | null> {
  return queryOne<PlatformConnection>(
    `select * from platform_connections where user_id = $1 and platform = $2`,
    [userId, platform]
  );
}

export async function upsertPlatformConnection(
  userId: string,
  payload: Omit<PlatformConnectionInsert, "user_id">
): Promise<PlatformConnection> {
  const row = await queryOne<PlatformConnection>(
    `insert into platform_connections (
       user_id, platform, access_token, refresh_token, expires_at,
       scope, platform_user_id, platform_username, meta, updated_at
     ) values (
       $1, $2, $3, $4, $5, $6, $7, $8,
       coalesce($9::jsonb, '{}'::jsonb), now()
     )
     on conflict (user_id, platform) do update set
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scope = excluded.scope,
       platform_user_id = excluded.platform_user_id,
       platform_username = excluded.platform_username,
       meta = excluded.meta,
       updated_at = now()
     returning *`,
    [
      userId,
      payload.platform,
      payload.access_token,
      payload.refresh_token ?? null,
      payload.expires_at ?? null,
      payload.scope ?? null,
      payload.platform_user_id ?? null,
      payload.platform_username ?? null,
      payload.meta != null ? JSON.stringify(payload.meta) : null,
    ]
  );
  if (!row) throw new Error("Failed to upsert platform connection");
  return row;
}

export async function deletePlatformConnection(
  userId: string,
  platform: PlatformName
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await query(
      `delete from platform_connections where user_id = $1 and platform = $2`,
      [userId, platform]
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}
