"use server";

import { ensureSocialAccountColumns } from "./ensureSocialAccountColumns";
import { query, queryMany, queryOne } from "./pg";
import type { TikTokScheduledPost } from "./types";

export async function createTikTokScheduledPost(
  payload: Pick<
    TikTokScheduledPost,
    | "user_id"
    | "carousel_id"
    | "export_id"
    | "media_token"
    | "slide_count"
    | "title"
    | "description"
    | "privacy_level"
    | "allow_comment"
    | "brand_organic"
    | "brand_content"
    | "tiktok_open_id"
    | "scheduled_for"
  >
): Promise<TikTokScheduledPost> {
  await ensureSocialAccountColumns();
  const row = await queryOne<TikTokScheduledPost>(
    `insert into tiktok_scheduled_posts (
       user_id, carousel_id, export_id, media_token, slide_count, title, description,
       privacy_level, allow_comment, brand_organic, brand_content, scheduled_for, tiktok_open_id
     ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
    [
      payload.user_id,
      payload.carousel_id,
      payload.export_id,
      payload.media_token,
      payload.slide_count,
      payload.title,
      payload.description,
      payload.privacy_level,
      payload.allow_comment,
      payload.brand_organic,
      payload.brand_content,
      payload.scheduled_for,
      payload.tiktok_open_id,
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

export type TikTokScheduledPostSummary = TikTokScheduledPost & {
  carousel_title: string;
  project_id: string;
};

/** Recent TikTok schedules across the user’s workspace (upcoming first). */
export async function listTikTokScheduledPostsForUser(
  userId: string,
  options?: { limit?: number }
): Promise<TikTokScheduledPostSummary[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 8, 20));
  return queryMany<TikTokScheduledPostSummary>(
    `select s.*, c.title as carousel_title, c.project_id
     from tiktok_scheduled_posts s
     join carousels c on c.id = s.carousel_id and c.user_id = s.user_id
     where s.user_id = $1
     order by
       case when s.status in ('scheduled', 'publishing') then 0 else 1 end,
       s.scheduled_for desc
     limit $2`,
    [userId, limit]
  );
}

/** TikTok schedules for carousels in one project. */
export async function listTikTokScheduledPostsForProject(
  userId: string,
  projectId: string,
  options?: { limit?: number }
): Promise<TikTokScheduledPostSummary[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 8, 20));
  return queryMany<TikTokScheduledPostSummary>(
    `select s.*, c.title as carousel_title, c.project_id
     from tiktok_scheduled_posts s
     join carousels c on c.id = s.carousel_id and c.user_id = s.user_id
     where s.user_id = $1 and c.project_id = $2
     order by
       case when s.status in ('scheduled', 'publishing') then 0 else 1 end,
       s.scheduled_for desc
     limit $3`,
    [userId, projectId, limit]
  );
}

/** Count posts still waiting to publish (or currently publishing). */
export async function countUpcomingTikTokScheduledPosts(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count
     from tiktok_scheduled_posts
     where user_id = $1 and status in ('scheduled', 'publishing')`,
    [userId]
  );
  return Math.max(0, parseInt(row?.count ?? "0", 10) || 0);
}

export type TikTokWorkspaceStats = {
  /** scheduled + publishing — become “posted” when TikTok finishes. */
  queued: number;
  /** Successfully published Direct Posts. */
  posted: number;
  /** Failed attempts that still need attention. */
  failed: number;
  /** Finished carousels that have never had a successful TikTok publish. */
  notPosted: number;
};

/** Compact TikTok pipeline stats for the workspace dashboard. */
export async function getTikTokWorkspaceStats(userId: string): Promise<TikTokWorkspaceStats> {
  const row = await queryOne<{
    queued: string;
    posted: string;
    failed: string;
    not_posted: string;
  }>(
    `select
       (select count(*)::text from tiktok_scheduled_posts
         where user_id = $1 and status in ('scheduled', 'publishing')) as queued,
       (select count(*)::text from tiktok_scheduled_posts
         where user_id = $1 and status = 'published') as posted,
       (select count(*)::text from tiktok_scheduled_posts
         where user_id = $1 and status = 'failed') as failed,
       (select count(*)::text from carousels c
         where c.user_id = $1
           and c.status in ('ready', 'generated')
           and not exists (
             select 1 from tiktok_scheduled_posts s
             where s.carousel_id = c.id
               and s.user_id = c.user_id
               and s.status = 'published'
           )) as not_posted`,
    [userId]
  );
  return {
    queued: Math.max(0, parseInt(row?.queued ?? "0", 10) || 0),
    posted: Math.max(0, parseInt(row?.posted ?? "0", 10) || 0),
    failed: Math.max(0, parseInt(row?.failed ?? "0", 10) || 0),
    notPosted: Math.max(0, parseInt(row?.not_posted ?? "0", 10) || 0),
  };
}

export async function getTikTokScheduledPostForMedia(
  scheduleId: string,
  mediaToken: string
): Promise<TikTokScheduledPost | null> {
  // TikTok pulls images after content/init and may retry for up to ~1 hour.
  // Keep URLs live through publishing, briefly after publish, and briefly after
  // failure so delayed downloads / retries do not 404.
  return queryOne<TikTokScheduledPost>(
    `select * from tiktok_scheduled_posts
     where id = $1
       and media_token = $2
       and (
         status in ('scheduled', 'publishing')
         or (status = 'published' and published_at > now() - interval '2 hours')
         or (status = 'failed' and updated_at > now() - interval '2 hours')
       )`,
    [scheduleId, mediaToken]
  );
}

/** Path-based media URLs look up by unguessable token only (no query string). */
export async function getTikTokScheduledPostByMediaToken(
  mediaToken: string
): Promise<TikTokScheduledPost | null> {
  if (!mediaToken || mediaToken.length < 16) return null;
  return queryOne<TikTokScheduledPost>(
    `select * from tiktok_scheduled_posts
     where media_token = $1
       and (
         status in ('scheduled', 'publishing')
         or (status = 'published' and published_at > now() - interval '2 hours')
         or (status = 'failed' and updated_at > now() - interval '2 hours')
       )
     limit 1`,
    [mediaToken]
  );
}

/** Claims due jobs atomically so concurrent cron requests cannot post twice. */
export async function claimDueTikTokScheduledPosts(limit = 5): Promise<TikTokScheduledPost[]> {
  return queryMany<TikTokScheduledPost>(
    `with due as (
       select id from tiktok_scheduled_posts
       where
         (status = 'scheduled' and scheduled_for <= now())
         or (
           status = 'publishing'
           and tiktok_publish_id is not null
           and updated_at <= now() - interval '20 seconds'
         )
         or (
           status = 'publishing'
           and tiktok_publish_id is null
           and updated_at <= now() - interval '2 minutes'
         )
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

export async function attachTikTokPublishId(scheduleId: string, publishId: string): Promise<void> {
  await query(
    `update tiktok_scheduled_posts
     set tiktok_publish_id = $2, status = 'publishing', updated_at = now()
     where id = $1`,
    [scheduleId, publishId]
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

export async function cancelTikTokScheduledPost(userId: string, scheduleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await queryOne<TikTokScheduledPost>(
    `update tiktok_scheduled_posts
     set status = 'cancelled', updated_at = now(), last_error = null
     where id = $1 and user_id = $2 and status = 'scheduled'
     returning *`,
    [scheduleId, userId]
  );
  if (!row) return { ok: false, error: "Only queued posts can be cancelled." };
  return { ok: true };
}

export async function rescheduleTikTokScheduledPost(
  userId: string,
  scheduleId: string,
  scheduledFor: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const when = new Date(scheduledFor);
  if (!Number.isFinite(when.getTime()) || when.getTime() < Date.now() + 60_000) {
    return { ok: false, error: "Choose a time at least one minute from now." };
  }
  const row = await queryOne<TikTokScheduledPost>(
    `update tiktok_scheduled_posts
     set scheduled_for = $3, updated_at = now(), last_error = null
     where id = $1 and user_id = $2 and status = 'scheduled'
     returning *`,
    [scheduleId, userId, when.toISOString()]
  );
  if (!row) return { ok: false, error: "Only queued posts can be rescheduled." };
  return { ok: true };
}
