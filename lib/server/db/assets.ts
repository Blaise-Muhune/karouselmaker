import { query, queryMany, queryOne } from "./pg";
import type { Asset, AssetInsert } from "./types";

export async function createAsset(
  userId: string,
  payload: Omit<AssetInsert, "user_id"> & { storage_path: string }
): Promise<Asset> {
  const row = await queryOne<Asset>(
    `insert into assets (
       user_id, project_id, kind, file_name, storage_path, width, height, blurhash
     ) values ($1, $2, coalesce($3, 'image'), $4, $5, $6, $7, $8)
     returning *`,
    [
      userId,
      payload.project_id ?? null,
      payload.kind ?? null,
      payload.file_name,
      payload.storage_path,
      payload.width ?? null,
      payload.height ?? null,
      payload.blurhash ?? null,
    ]
  );
  if (!row) throw new Error("Failed to create asset");
  return row;
}

export async function getAsset(
  userId: string,
  assetId: string
): Promise<Asset | null> {
  return queryOne<Asset>(`select * from assets where id = $1 and user_id = $2`, [
    assetId,
    userId,
  ]);
}

export async function countAssets(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from assets where user_id = $1`,
    [userId]
  );
  return Number(row?.count ?? 0);
}

export async function listAssets(
  userId: string,
  options: { projectId?: string | null; limit?: number } = {}
): Promise<Asset[]> {
  const limit = options.limit ?? 100;
  if (options.projectId !== undefined && options.projectId !== null) {
    return queryMany<Asset>(
      `select * from assets where user_id = $1 and project_id = $2
       order by created_at desc limit $3`,
      [userId, options.projectId, limit]
    );
  }
  if (options.projectId === null) {
    return queryMany<Asset>(
      `select * from assets where user_id = $1 and project_id is null
       order by created_at desc limit $2`,
      [userId, limit]
    );
  }
  return queryMany<Asset>(
    `select * from assets where user_id = $1 order by created_at desc limit $2`,
    [userId, limit]
  );
}

export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const res = await query(`delete from assets where id = $1 and user_id = $2`, [
    assetId,
    userId,
  ]);
  if (res.rowCount === 0) throw new Error("Asset not found");
}
