"use server";

import { query, queryMany, queryOne } from "./pg";
import type { Slide, SlideInsert, SlideUpdate } from "./types";

async function assertCarouselOwned(userId: string, carouselId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `select id from carousels where id = $1 and user_id = $2`,
    [carouselId, userId]
  );
  return !!row;
}

export async function replaceSlides(
  userId: string,
  carouselId: string,
  slides: SlideInsert[]
): Promise<Slide[]> {
  if (!(await assertCarouselOwned(userId, carouselId))) {
    throw new Error("Carousel not found");
  }

  await query(`delete from slides where carousel_id = $1`, [carouselId]);

  if (slides.length === 0) {
    await query(
      `update carousels set updated_at = now() where id = $1 and user_id = $2`,
      [carouselId, userId]
    );
    return [];
  }

  const inserted: Slide[] = [];
  for (const s of slides) {
    const row = await queryOne<Slide>(
      `insert into slides (
         carousel_id, slide_index, slide_type, headline, body,
         template_id, background, meta
       ) values (
         $1, $2, $3, $4, $5, $6,
         coalesce($7::jsonb, '{}'::jsonb),
         coalesce($8::jsonb, '{}'::jsonb)
       )
       returning *`,
      [
        carouselId,
        s.slide_index,
        s.slide_type,
        s.headline,
        s.body ?? null,
        s.template_id ?? null,
        JSON.stringify(s.background ?? {}),
        JSON.stringify(s.meta ?? {}),
      ]
    );
    if (row) inserted.push(row);
  }

  await query(
    `update carousels set updated_at = now() where id = $1 and user_id = $2`,
    [carouselId, userId]
  );

  return inserted;
}

export async function updateSlide(
  userId: string,
  slideId: string,
  patch: SlideUpdate
): Promise<Slide> {
  const owned = await queryOne<{ carousel_id: string }>(
    `select s.carousel_id
     from slides s
     join carousels c on c.id = s.carousel_id
     where s.id = $1 and c.user_id = $2`,
    [slideId, userId]
  );
  if (!owned) throw new Error("Slide not found");

  const sets: string[] = ["updated_at = now()"];
  const params: unknown[] = [slideId];
  const add = (col: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${col} = $${params.length}${cast}`);
  };

  if (patch.slide_index !== undefined) add("slide_index", patch.slide_index);
  if (patch.slide_type !== undefined) add("slide_type", patch.slide_type);
  if (patch.headline !== undefined) add("headline", patch.headline);
  if (patch.body !== undefined) add("body", patch.body);
  if (patch.template_id !== undefined) add("template_id", patch.template_id);
  if (patch.background !== undefined)
    add("background", JSON.stringify(patch.background), "::jsonb");
  if (patch.meta !== undefined) add("meta", JSON.stringify(patch.meta), "::jsonb");

  const row = await queryOne<Slide>(
    `update slides set ${sets.join(", ")} where id = $1 returning *`,
    params
  );
  if (!row) throw new Error("Slide not found");

  await query(
    `update carousels set updated_at = now() where id = $1 and user_id = $2`,
    [owned.carousel_id, userId]
  );

  return row;
}

export async function getSlide(
  userId: string,
  slideId: string
): Promise<Slide | null> {
  return queryOne<Slide>(
    `select s.*
     from slides s
     join carousels c on c.id = s.carousel_id
     where s.id = $1 and c.user_id = $2`,
    [slideId, userId]
  );
}

export async function listSlides(
  userId: string,
  carouselId: string
): Promise<Slide[]> {
  if (!(await assertCarouselOwned(userId, carouselId))) {
    return [];
  }
  return queryMany<Slide>(
    `select * from slides where carousel_id = $1 order by slide_index asc`,
    [carouselId]
  );
}

/** Returns slide count per carousel. Only includes carousels the user owns. */
export async function getSlideCountsForCarousels(
  userId: string,
  carouselIds: string[]
): Promise<Record<string, number>> {
  if (carouselIds.length === 0) return {};
  const rows = await queryMany<{ carousel_id: string; count: string }>(
    `select s.carousel_id, count(*)::text as count
     from slides s
     join carousels c on c.id = s.carousel_id
     where c.user_id = $1 and s.carousel_id = any($2::uuid[])
     group by s.carousel_id`,
    [userId, carouselIds]
  );
  const countByCarousel: Record<string, number> = {};
  for (const id of carouselIds) countByCarousel[id] = 0;
  for (const row of rows) {
    countByCarousel[row.carousel_id] = Number(row.count);
  }
  return countByCarousel;
}

/** Returns first slide id per carousel (by slide_index). */
export async function getFirstSlideIdsForCarousels(
  userId: string,
  carouselIds: string[]
): Promise<Record<string, string>> {
  if (carouselIds.length === 0) return {};
  const rows = await queryMany<{ id: string; carousel_id: string }>(
    `select distinct on (s.carousel_id) s.id, s.carousel_id
     from slides s
     join carousels c on c.id = s.carousel_id
     where c.user_id = $1 and s.carousel_id = any($2::uuid[])
     order by s.carousel_id, s.slide_index asc`,
    [userId, carouselIds]
  );
  const firstByCarousel: Record<string, string> = {};
  for (const row of rows) {
    firstByCarousel[row.carousel_id] = row.id;
  }
  return firstByCarousel;
}

/** Delete one slide and re-index remaining slides (1-based, no gaps). */
export async function deleteSlide(userId: string, slideId: string): Promise<void> {
  const owned = await queryOne<{ carousel_id: string }>(
    `select s.carousel_id
     from slides s
     join carousels c on c.id = s.carousel_id
     where s.id = $1 and c.user_id = $2`,
    [slideId, userId]
  );
  if (!owned) throw new Error("Slide not found");

  await query(`delete from slides where id = $1`, [slideId]);
  const remaining = await listSlides(userId, owned.carousel_id);
  for (let i = 0; i < remaining.length; i++) {
    await query(
      `update slides set slide_index = $1, updated_at = now() where id = $2`,
      [i + 1, remaining[i]!.id]
    );
  }
}

/** Append a new empty slide to the carousel. */
export async function createSlide(
  userId: string,
  carouselId: string,
  defaultTemplateId?: string | null
): Promise<Slide> {
  if (!(await assertCarouselOwned(userId, carouselId))) {
    throw new Error("Carousel not found");
  }
  const existing = await listSlides(userId, carouselId);
  const nextIndex = existing.length + 1;
  const row = await queryOne<Slide>(
    `insert into slides (
       carousel_id, slide_index, slide_type, headline, body,
       template_id, background, meta
     ) values ($1, $2, 'generic', '', null, $3, '{}'::jsonb, '{}'::jsonb)
     returning *`,
    [carouselId, nextIndex, defaultTemplateId ?? null]
  );
  if (!row) throw new Error("Failed to create slide");
  return row;
}
