"use server";

import { query, queryMany, queryOne } from "./pg";
import type { TikTokScheduledPost } from "./types";

export async function createTikTokScheduledPost(
  payload: Pick<
    TikTokScheduledPost,
    "user_id" | "carousel_id" | "export_id" | "media_token" | "slide_count" | "title" | "description" | "privacy_level" | "scheduled_for"
  >
): Promise<TikTokScheduledPost> {
  const row = await queryOne<TikTokScheduledPost>(
    `insert into tiktok_scheduled_posts (
       user_id, carousel_id, export_id, media_token, slide_count, title, description, privacy_level, scheduled_for
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [
      payload.user_id,
      payload.carousel_id,
      payload.export_id,
      payload.media_token,
      payload.slide_count,
      payload.title,
      payload.description,
      payload.privacy_level,
      payload.scheduled_for,
    ]
  );
  if (!row) throw new Error("Unable to create TikTok schedule");
  return row;
}

export async function listTikTokScheduledPosts(userId: string, carouselId: string): Promise<TikTokScheduledPost[]> {
  return queryMany<TikTokScheduledPost>(
    `select * from tiktok_scheduled_posts
     where user_id = $1 and carousel_id = $2
     order by scheduled_for desc
     limit 8`,
    [userId, carouselId]
  );
}

export async function getTikTokScheduledPostForMedia(
  scheduleId: string,
  mediaToken: string
): Promise<TikTokScheduledPost | null> {
  return queryOne<TikTokScheduledPost>(
    `select * from tiktok_scheduled_posts
     where id = $1 and media_token = $2 and status in ('scheduled', 'publishing')`,
    [scheduleId, mediaToken]
  );
}

/** Claims due jobs atomically so concurrent cron requests cannot post twice. */
export async function claimDueTikTokScheduledPosts(limit = 5): Promise<TikTokScheduledPost[]> {
  return queryMany<TikTokScheduledPost>(
    `with due as (
       select id from tiktok_scheduled_posts
       where status = 'scheduled' and scheduled_for <= now()
       order by scheduled_for asc
       limit $1
       for update skip locked
     )
     update tiktok_scheduled_posts scheduled
     set status = 'publishing', updated_at = now()
     from due
     where scheduled.id = due.id
     returning scheduled.*`,
    [Math.max(1, Math.min(limit, 20))]
  );
}

export async function markTikTokScheduledPostPublished(scheduleId: string, publishId: string): Promise<void> {
  await query(
    `update tiktok_scheduled_posts
     set status = 'published', tiktok_publish_id = $2, published_at = now(), last_error = null, updated_at = now()
     where id = $1`,
    [scheduleId, publishId]
  );
}

export async function markTikTokScheduledPostFailed(scheduleId: string, error: string): Promise<void> {
  await query(
    `update tiktok_scheduled_posts
     set status = 'failed', last_error = $2, updated_at = now()
     where id = $1`,
    [scheduleId, error.slice(0, 1000)]
  );
}
