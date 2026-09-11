# Docs

Project and environment documentation.

## Backend structure

- `lib/server/` — server-only utilities and server actions
- `lib/server/db/` — Azure Postgres access (`pg` + `DATABASE_URL`)
- `lib/supabase/` — Supabase Auth + Storage clients
- `lib/ai/` — AI / LLM integration for carousel content
- `lib/renderer/` — carousel slide rendering and export

## Environment variables

See root `.env.example`, [Environment variables](env.md), [Azure Postgres](azure-postgres.md), and [Supabase](supabase.md).
