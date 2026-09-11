# Environment variables

Required for local and production:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Auth + Storage) | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only; Auth admin / Storage) | For admin/background jobs |
| `DATABASE_URL` | Azure PostgreSQL connection string (`sslmode=require`) | Yes |

Copy `.env.example` to `.env.local` and fill in values. App tables live on Azure Postgres — see [Azure Postgres](azure-postgres.md). Auth and file storage stay on Supabase — see [Supabase setup](supabase.md).
