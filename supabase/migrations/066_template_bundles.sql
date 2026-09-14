-- Keep Supabase schema in step with Azure schema/007_template_bundles.sql.
create table if not exists public.template_bundles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  template_ids uuid[] not null check (cardinality(template_ids) between 1 and 3),
  is_locked boolean not null default true,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_template_bundles_user_id on public.template_bundles(user_id);

insert into public.template_bundles (id, user_id, name, template_ids, is_locked)
values
  ('00000000-0000-4000-8000-000000000201', null, 'Ink Story', array[
    '00000000-0000-4000-8000-000000000101'::uuid,
    '00000000-0000-4000-8000-000000000104'::uuid,
    '00000000-0000-4000-8000-000000000103'::uuid
  ], true),
  ('00000000-0000-4000-8000-000000000202', null, 'Clean Explain', array[
    '00000000-0000-4000-8000-000000000102'::uuid,
    '00000000-0000-4000-8000-000000000105'::uuid
  ], true)
on conflict (id) do nothing;
