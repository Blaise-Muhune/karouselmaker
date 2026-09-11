# Azure PostgreSQL

App tables (projects, carousels, slides, templates, profiles, exports, assets, etc.) run on **Azure Database for PostgreSQL Flexible Server**. Supabase is used for **Auth** and **Storage** only.

## Required env

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://user:pass@host:5432/karouselmaker?sslmode=require` |

Local secret file (gitignored): `.azure-pg-secret.local.json` — created when provisioning. Copy `connectionString` into `.env.local` as `DATABASE_URL`.

Apply schema:

```bash
node scripts/azure-apply-schema.mjs
```

## Auth model

- Users sign in with **Supabase Auth**.
- Server code loads `user.id` via `getUser()` and scopes every query with `user_id` / ownership joins.
- There is **no RLS** on Azure; do not query Azure from the browser.

## Storage

Still Supabase Storage bucket `carousel-assets` (signed URLs, uploads). Export ZIP/PNG paths are unchanged.

## Provisioned server (this subscription)

- Host: `km-pg-westus-6491.postgres.database.azure.com`
- Database: `karouselmaker`
- Resource group: `rg-km-westus`
- Region: West US
