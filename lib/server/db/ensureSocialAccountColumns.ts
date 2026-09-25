import { query, queryMany } from "./pg";

let ensured: Promise<void> | null = null;

/**
 * Applies azure/schema/010_social_accounts_per_project.sql on demand for deployments where it
 * has not been run. Checks information_schema first so the ALTER (and its table lock) only
 * happens when a column is actually missing.
 */
export function ensureSocialAccountColumns(): Promise<void> {
  ensured ??= (async () => {
    const rows = await queryMany<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and ((table_name = 'projects' and column_name = 'social_accounts')
           or (table_name = 'tiktok_scheduled_posts' and column_name = 'tiktok_open_id'))`
    );
    const has = (table: string, column: string) =>
      rows.some((r) => r.table_name === table && r.column_name === column);
    if (!has("projects", "social_accounts")) {
      await query(
        `alter table public.projects add column if not exists social_accounts jsonb not null default '{}'::jsonb`
      );
    }
    if (!has("tiktok_scheduled_posts", "tiktok_open_id")) {
      await query(`alter table public.tiktok_scheduled_posts add column if not exists tiktok_open_id text`);
    }
  })().catch((error) => {
    ensured = null;
    throw error;
  });
  return ensured;
}
