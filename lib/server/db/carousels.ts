"use server";

import { query, queryMany, queryOne } from "./pg";
import { listSlides } from "./slides";
import type { Carousel } from "./types";

const CAROUSEL_TITLE_MAX = 200;
const COPY_SUFFIX = " (copy)";

function duplicateCarouselTitle(sourceTitle: string): string {
  const base = sourceTitle.trim() || "Untitled";
  if (base.length + COPY_SUFFIX.length <= CAROUSEL_TITLE_MAX) {
    return `${base}${COPY_SUFFIX}`;
  }
  return `${base.slice(0, CAROUSEL_TITLE_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

export async function createCarousel(
  userId: string,
  projectId: string,
  inputType: string,
  inputValue: string,
  title: string
): Promise<Carousel> {
  const row = await queryOne<Carousel>(
    `insert into carousels (
       user_id, project_id, title, input_type, input_value, status, export_size
     ) values ($1, $2, $3, $4, $5, 'draft', '1080x1350')
     returning *`,
    [userId, projectId, title, inputType, inputValue]
  );
  if (!row) throw new Error("Failed to create carousel");
  return row;
}

export async function getCarousel(
  userId: string,
  carouselId: string
): Promise<Carousel | null> {
  return queryOne<Carousel>(
    `select * from carousels where id = $1 and user_id = $2`,
    [carouselId, userId]
  );
}

export async function countCarouselsThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from carousels
     where user_id = $1 and created_at >= $2`,
    [userId, startOfMonth.toISOString()]
  );
  return Number(row?.count ?? 0);
}

/** Total carousels ever created by the user (for free-tier "3 full access" trial). */
export async function countCarouselsLifetime(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from carousels where user_id = $1`,
    [userId]
  );
  return Number(row?.count ?? 0);
}

/** Count carousels generated with AI images (use_ai_generate) by this user in the current month. */
export async function countAiGenerateCarouselsThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from carousels
     where user_id = $1
       and created_at >= $2
       and generation_options @> '{"use_ai_generate": true}'::jsonb`,
    [userId, startOfMonth.toISOString()]
  );
  return Number(row?.count ?? 0);
}

export async function countCarousels(
  userId: string,
  projectId: string
): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from carousels
     where user_id = $1 and project_id = $2`,
    [userId, projectId]
  );
  return Number(row?.count ?? 0);
}

export async function listCarousels(
  userId: string,
  projectId: string,
  options?: { limit?: number; offset?: number }
): Promise<Carousel[]> {
  if (options?.limit != null) {
    const offset = options.offset ?? 0;
    return queryMany<Carousel>(
      `select * from carousels
       where user_id = $1 and project_id = $2
       order by updated_at desc, created_at desc
       limit $3 offset $4`,
      [userId, projectId, options.limit, offset]
    );
  }
  return queryMany<Carousel>(
    `select * from carousels
     where user_id = $1 and project_id = $2
     order by updated_at desc, created_at desc`,
    [userId, projectId]
  );
}

/**
 * Deep copy: new carousel row + cloned slides (new IDs). Strips in-flight generation flags.
 * Does not copy exports.
 */
export async function cloneCarousel(
  userId: string,
  sourceCarouselId: string,
  projectId: string
): Promise<Carousel> {
  const source = await getCarousel(userId, sourceCarouselId);
  if (!source || source.project_id !== projectId) {
    throw new Error("Carousel not found");
  }

  const slides = await listSlides(userId, sourceCarouselId);
  const goRaw = { ...((source.generation_options ?? {}) as Record<string, unknown>) };
  delete goRaw.generation_started;
  delete goRaw.generation_complete;
  delete goRaw.ai_backgrounds_pending;
  delete goRaw.generation_error_recovery;

  const status =
    source.status === "generating"
      ? "draft"
      : source.status === "generated"
        ? "generated"
        : source.status;

  const newCarousel = await queryOne<Carousel>(
    `insert into carousels (
       user_id, project_id, title, input_type, input_value, status,
       caption_variants, hashtags, export_format, export_size, is_favorite,
       include_first_slide, include_last_slide, generation_options
     ) values (
       $1, $2, $3, $4, $5, $6,
       coalesce($7::jsonb, '{}'::jsonb), coalesce($8, '{}'::text[]),
       coalesce($9, 'png'), coalesce($10, '1080x1350'), false,
       coalesce($11, true), coalesce($12, true), coalesce($13::jsonb, '{}'::jsonb)
     )
     returning *`,
    [
      userId,
      projectId,
      duplicateCarouselTitle(source.title),
      source.input_type,
      source.input_value,
      status,
      JSON.stringify(source.caption_variants ?? {}),
      source.hashtags ?? [],
      source.export_format ?? "png",
      source.export_size ?? "1080x1350",
      source.include_first_slide ?? true,
      source.include_last_slide ?? true,
      JSON.stringify(goRaw),
    ]
  );
  if (!newCarousel) throw new Error("Failed to duplicate carousel");

  if (slides.length > 0) {
    try {
      for (const s of slides) {
        await query(
          `insert into slides (
             carousel_id, slide_index, slide_type, headline, body,
             template_id, background, meta
           ) values ($1, $2, $3, $4, $5, $6, coalesce($7::jsonb, '{}'::jsonb), coalesce($8::jsonb, '{}'::jsonb))`,
          [
            newCarousel.id,
            s.slide_index,
            s.slide_type,
            s.headline,
            s.body,
            s.template_id,
            JSON.stringify(s.background ?? {}),
            JSON.stringify(s.meta ?? {}),
          ]
        );
      }
    } catch (e) {
      await query(`delete from carousels where id = $1 and user_id = $2`, [
        newCarousel.id,
        userId,
      ]);
      throw e instanceof Error ? e : new Error("Failed to duplicate slides");
    }
  }

  return newCarousel;
}

export async function deleteCarousel(
  userId: string,
  carouselId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await query(`delete from carousels where id = $1 and user_id = $2`, [
      carouselId,
      userId,
    ]);
    if (res.rowCount === 0) return { ok: false, error: "Carousel not found" };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
}

export async function updateCarousel(
  userId: string,
  carouselId: string,
  patch: {
    title?: string;
    input_type?: string;
    input_value?: string;
    status?: string;
    caption_variants?: Record<string, unknown>;
    hashtags?: string[];
    export_format?: string;
    export_size?: string;
    is_favorite?: boolean;
    include_first_slide?: boolean;
    include_last_slide?: boolean;
    generation_options?: Record<string, unknown>;
  }
): Promise<Carousel> {
  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [carouselId, userId];
  const add = (col: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
  };

  if (patch.title !== undefined) add("title", patch.title);
  if (patch.input_type !== undefined) add("input_type", patch.input_type);
  if (patch.input_value !== undefined) add("input_value", patch.input_value);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.caption_variants !== undefined)
    add("caption_variants", JSON.stringify(patch.caption_variants), "::jsonb");
  if (patch.hashtags !== undefined) add("hashtags", patch.hashtags);
  if (patch.export_format !== undefined) add("export_format", patch.export_format);
  if (patch.export_size !== undefined) add("export_size", patch.export_size);
  if (patch.is_favorite !== undefined) add("is_favorite", patch.is_favorite);
  if (patch.include_first_slide !== undefined)
    add("include_first_slide", patch.include_first_slide);
  if (patch.include_last_slide !== undefined)
    add("include_last_slide", patch.include_last_slide);
  if (patch.generation_options !== undefined)
    add("generation_options", JSON.stringify(patch.generation_options), "::jsonb");

  const row = await queryOne<Carousel>(
    `update carousels set ${sets.join(", ")} where id = $1 and user_id = $2 returning *`,
    params
  );
  if (!row) throw new Error("Carousel not found");
  return row;
}
