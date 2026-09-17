import { query, queryMany, queryOne } from "./pg";
import type { ExportRow } from "./types";

/** An export with the owner information needed to remove its storage directory. */
export type StoredExport = ExportRow & { user_id: string };

/**
 * Storage path convention (Supabase Storage bucket):
 * - user/{userId}/exports/{carouselId}/{exportId}/slides/01.png, 02.png, ...
 * - user/{userId}/exports/{carouselId}/{exportId}/carousel.zip
 */
export async function getExport(
  userId: string,
  exportId: string
): Promise<ExportRow | null> {
  return queryOne<ExportRow>(
    `select e.*
     from exports e
     join carousels c on c.id = e.carousel_id
     where e.id = $1 and c.user_id = $2`,
    [exportId, userId]
  );
}

export function getExportStoragePaths(
  userId: string,
  carouselId: string,
  exportId: string
): {
  slidesDir: string;
  zipPath: string;
  slidePath: (index: number) => string;
  overlayPath: (index: number) => string;
  videoBgPath: (slideIndex: number, bgIndex: number, ext?: string) => string;
  videoSlidePath: (slideIndex: number, variantIndex: number) => string;
  videoSlidesPrefix: string;
} {
  const prefix = `user/${userId}/exports/${carouselId}/${exportId}`;
  return {
    slidesDir: `${prefix}/slides`,
    zipPath: `${prefix}/carousel.zip`,
    slidePath: (index: number) =>
      `${prefix}/slides/${String(index + 1).padStart(2, "0")}.png`,
    overlayPath: (index: number) =>
      `${prefix}/slides/overlay_${String(index + 1).padStart(2, "0")}.png`,
    videoBgPath: (slideIndex: number, bgIndex: number, ext = "jpg") =>
      `${prefix}/video-bg/${slideIndex}-${bgIndex}.${ext}`,
    videoSlidePath: (slideIndex: number, variantIndex: number) =>
      `${prefix}/video-slides/${slideIndex}-${variantIndex}.png`,
    videoSlidesPrefix: `${prefix}/video-slides/`,
  };
}

export function getVideoRenderStoragePaths(
  userId: string,
  carouselId: string,
  runId: string
): {
  slidePath: (index: number) => string;
  overlayPath: (index: number) => string;
  videoBgPath: (slideIndex: number, bgIndex: number, ext?: string) => string;
  videoSlidePath: (slideIndex: number, variantIndex: number) => string;
  videoSlidesPrefix: string;
} {
  const prefix = `user/${userId}/video-renders/${carouselId}/${runId}`;
  return {
    slidePath: (index: number) =>
      `${prefix}/slides/${String(index + 1).padStart(2, "0")}.png`,
    overlayPath: (index: number) =>
      `${prefix}/slides/overlay_${String(index + 1).padStart(2, "0")}.png`,
    videoBgPath: (slideIndex: number, bgIndex: number, ext = "jpg") =>
      `${prefix}/video-bg/${slideIndex}-${bgIndex}.${ext}`,
    videoSlidePath: (slideIndex: number, variantIndex: number) =>
      `${prefix}/video-slides/${slideIndex}-${variantIndex}.png`,
    videoSlidesPrefix: `${prefix}/video-slides/`,
  };
}

export async function createExport(
  userId: string,
  carouselId: string,
  format: string = "png"
): Promise<ExportRow> {
  const carousel = await queryOne<{ id: string }>(
    `select id from carousels where id = $1 and user_id = $2`,
    [carouselId, userId]
  );
  if (!carousel) throw new Error("Carousel not found");

  const row = await queryOne<ExportRow>(
    `insert into exports (carousel_id, format, status)
     values ($1, $2, 'pending')
     returning *`,
    [carouselId, format]
  );
  if (!row) throw new Error("Failed to create export");
  return row;
}

export async function updateExport(
  userId: string,
  exportId: string,
  patch: { status: string; storage_path?: string | null }
): Promise<ExportRow> {
  const owned = await queryOne<{ id: string }>(
    `select e.id
     from exports e
     join carousels c on c.id = e.carousel_id
     where e.id = $1 and c.user_id = $2`,
    [exportId, userId]
  );
  if (!owned) throw new Error("Export not found");

  const row =
    patch.storage_path !== undefined
      ? await queryOne<ExportRow>(
          `update exports set status = $2, storage_path = $3 where id = $1 returning *`,
          [exportId, patch.status, patch.storage_path]
        )
      : await queryOne<ExportRow>(
          `update exports set status = $2 where id = $1 returning *`,
          [exportId, patch.status]
        );
  if (!row) throw new Error("Export not found");
  return row;
}

export async function countExportsThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count
     from exports e
     join carousels c on c.id = e.carousel_id
     where c.user_id = $1
       and e.status = 'ready'
       and e.created_at >= $2`,
    [userId, startOfMonth.toISOString()]
  );
  return Number(row?.count ?? 0);
}

export async function listExportsByCarousel(
  userId: string,
  carouselId: string,
  limit: number = 10
): Promise<ExportRow[]> {
  const carousel = await queryOne<{ id: string }>(
    `select id from carousels where id = $1 and user_id = $2`,
    [carouselId, userId]
  );
  if (!carousel) return [];

  return queryMany<ExportRow>(
    `select * from exports
     where carousel_id = $1
     order by created_at desc
     limit $2`,
    [carouselId, limit]
  );
}

export async function listStoredExportsByCarousel(
  userId: string,
  carouselId: string
): Promise<StoredExport[]> {
  return queryMany<StoredExport>(
    `select e.*, c.user_id
     from exports e
     join carousels c on c.id = e.carousel_id
     where c.user_id = $1 and e.carousel_id = $2 and e.storage_path is not null
     order by e.created_at desc`,
    [userId, carouselId]
  );
}

export async function listStoredExportsByProject(
  userId: string,
  projectId: string
): Promise<StoredExport[]> {
  return queryMany<StoredExport>(
    `select e.*, c.user_id
     from exports e
     join carousels c on c.id = e.carousel_id
     where c.user_id = $1 and c.project_id = $2 and e.storage_path is not null
     order by e.created_at desc`,
    [userId, projectId]
  );
}

export async function hasActiveTikTokScheduleForExport(
  userId: string,
  exportId: string
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `select id from tiktok_scheduled_posts
     where user_id = $1 and export_id = $2 and status in ('scheduled', 'publishing')
     limit 1`,
    [userId, exportId]
  );
  return !!row;
}

/** Eligible exports follow the documented 1-day normal / 7-day TikTok retention. */
export async function listExpiredStoredExports(limit: number): Promise<StoredExport[]> {
  return queryMany<StoredExport>(
    `select e.*, c.user_id
     from exports e
     join carousels c on c.id = e.carousel_id
     where e.storage_path is not null
       and (
         (
           not exists (select 1 from tiktok_scheduled_posts s where s.export_id = e.id)
           and e.created_at < now() - interval '1 day'
         )
         or (
           exists (
             select 1 from tiktok_scheduled_posts s
             where s.export_id = e.id
               and s.status in ('published', 'failed', 'cancelled')
               and coalesce(s.published_at, s.updated_at, s.created_at) < now() - interval '7 days'
           )
           and not exists (
             select 1 from tiktok_scheduled_posts s
             where s.export_id = e.id and s.status in ('scheduled', 'publishing')
           )
         )
       )
     order by e.created_at asc
     limit $1`,
    [Math.max(1, Math.min(limit, 500))]
  );
}

export async function clearExportStoragePath(exportId: string): Promise<void> {
  await query(`update exports set storage_path = null where id = $1`, [exportId]);
}
