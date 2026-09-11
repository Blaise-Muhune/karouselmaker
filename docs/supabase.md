# Supabase setup

Supabase provides **Auth** and **Storage**. App tables live on **Azure PostgreSQL** — see [Azure Postgres](azure-postgres.md).

## Required environment variables

| Variable | Description | Where used |
|----------|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous (public) key | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (Auth admin / Storage) | Server-only |
| `DATABASE_URL` | Azure Postgres connection string | Server DB helpers |

Copy `.env.example` to `.env.local` and set values. Never expose the service role key or `DATABASE_URL` to the client.

## Tables overview

App tables (`profiles`, `projects`, `templates`, `carousels`, `slides`, `exports`, `assets`, …) are on Azure. Schema: `azure/schema/001_init.sql`. Server helpers in `lib/server/db/*` use `pg` and always scope by the authenticated `user.id`.

## Authorization

- **Supabase Auth** issues the session.
- **Server layer** enforces ownership (`user_id = getUser().id` or joins through owned carousels).
- Azure has no RLS; do not access the database from the client.

## Storage bucket: carousel-assets

- **Bucket name**: `carousel-assets`
- **Access**: Private. No public URLs.
- **Path convention**:
  - `user/{userId}/backgrounds/...` — user-uploaded background images
  - `user/{userId}/exports/...` — export outputs (e.g. PNGs, ZIPs)

**Policies**: RLS on `storage.objects` restricts SELECT/INSERT/UPDATE/DELETE to rows where:

1. `bucket_id = 'carousel-assets'`
2. First path segment is `user`
3. Second path segment equals `auth.uid()::text`

So each user can read/write only under `user/{their_uid}/...`. Applied via migration `007_storage_carousel_assets.sql`.

**Configuring the bucket**: Run all migrations (including `007_storage_carousel_assets.sql`) against your project. The bucket is created by the migration; folder structure is implied by upload paths (e.g. `user/{userId}/exports/...`). No extra dashboard steps required unless you need to change bucket limits or MIME rules.
