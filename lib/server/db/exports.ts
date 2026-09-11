import { query, queryMany, queryOne } from "./pg";
import type { ExportRow } from "./types";

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
