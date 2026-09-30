import { query, queryMany, queryOne } from "./pg";

export type CarouselPostStatus = "posted" | "scheduled";

let ensured: Promise<void> | null = null;

/** Applies azure/schema/011_carousel_instagram_posted_at.sql on demand for deployments where it has not been run. */
function ensureInstagramPostedColumn(): Promise<void> {
  ensured ??= (async () => {
    const row = await queryOne<{ present: boolean }>(
      `select exists(
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'carousels' and column_name = 'instagram_posted_at'
       ) as present`
    );
    if (!row?.present) {
      await query(`alter table public.carousels add column if not exists instagram_posted_at timestamptz`);
    }
  })().catch((error) => {
    ensured = null;
    throw error;
  });
  return ensured;
}

export async function markCarouselPostedToInstagram(userId: string, carouselId: string): Promise<void> {
  await ensureInstagramPostedColumn();
  await query(`update carousels set instagram_posted_at = now() where id = $1 and user_id = $2`, [carouselId, userId]);
}

/** Posted wins over scheduled: a TikTok publish or an Instagram post marks the carousel as posted. */
export async function getPostStatusForCarousels(
  userId: string,
  carouselIds: string[]
): Promise<Record<string, CarouselPostStatus>> {
  if (carouselIds.length === 0) return {};
  await ensureInstagramPostedColumn();
  const rows = await queryMany<{ id: string; posted: boolean; scheduled: boolean }>(
    `select c.id,
       (c.instagram_posted_at is not null or bool_or(s.status = 'published')) as posted,
       coalesce(bool_or(s.status in ('scheduled', 'publishing')), false) as scheduled
     from carousels c
     left join tiktok_scheduled_posts s on s.carousel_id = c.id and s.user_id = c.user_id
     where c.user_id = $1 and c.id = any($2::uuid[])
     group by c.id`,
    [userId, carouselIds]
  );
  const result: Record<string, CarouselPostStatus> = {};
  for (const row of rows) {
    if (row.posted) result[row.id] = "posted";
    else if (row.scheduled) result[row.id] = "scheduled";
  }
  return result;
}

/** The carousel created right after this one in the same project, if any. */
export async function getNextCarouselInProject(
  userId: string,
  projectId: string,
  carouselId: string
): Promise<{ id: string; title: string } | null> {
  return queryOne<{ id: string; title: string }>(
    `select n.id, n.title
     from carousels cur
     join carousels n on n.project_id = cur.project_id and n.user_id = cur.user_id
     where cur.id = $3 and cur.user_id = $1 and cur.project_id = $2
       and (n.created_at, n.id) > (cur.created_at, cur.id)
     order by n.created_at asc, n.id asc
     limit 1`,
    [userId, projectId, carouselId]
  );
}
