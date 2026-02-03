# Environment variables

Required for local and production:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only; bypasses RLS) | For admin/background jobs |

Copy `.env.example` to `.env.local` and fill in values from the Supabase dashboard. See [Supabase setup](supabase.md) for details.
