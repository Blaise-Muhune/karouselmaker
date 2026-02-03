# Supabase setup

Required env, schema, RLS, and storage for the carousel creator app.

## Required environment variables

| Variable | Description | Where used |
|----------|-------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymous (public) key; RLS applies | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key; bypasses RLS | Server-only (admin/background jobs) |

Copy `.env.example` to `.env.local` and set values from the Supabase dashboard. Never expose the service role key to the client.

## Tables overview

| Table | Purpose |
|------|---------|
| **profiles** | One row per auth user; display name, etc. |
| **projects** | User projects: niche, tone, voice rules, slide structure, brand kit. |
| **templates** | Layout templates (user or system). Category, aspect ratio, config, locked flag. |
| **carousels** | One carousel run per project: title, input type/value, status (draft \| generated \| exported). |
| **slides** | Slides in a carousel: index, type, headline, body, template, background, meta. |
| **exports** | Export jobs: format (png \| zip), status (pending \| ready \| failed), storage path. |

Relations: `profiles.user_id` → auth.users. `projects.user_id` → auth.users. `templates.user_id` → auth.users (nullable for system). `carousels` → projects + user. `slides` → carousels + optional template. `exports` → carousels.

## RLS principles

- **RLS is enabled** on every app table. No row is visible or writable unless a policy allows it.
- **User-owned tables** (profiles, projects, carousels): policies allow SELECT/INSERT/UPDATE/DELETE only when `user_id = auth.uid()`.
- **Templates**: SELECT allowed for own rows or `user_id IS NULL` (system templates). INSERT/UPDATE/DELETE only when `user_id = auth.uid()`.
- **Child tables** (slides, exports): access only if the parent carousel belongs to the current user. Implemented with `EXISTS (SELECT 1 FROM carousels c WHERE c.id = slides.carousel_id AND c.user_id = auth.uid())`.
- **Defense in depth**: server-side DB helpers always scope by `userId` (from the authenticated session) and rely on RLS as the primary enforcement.

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
