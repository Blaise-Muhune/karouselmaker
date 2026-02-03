-- user_slide_presets: reusable template + gradient overlay + display settings
create table public.user_slide_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  template_id uuid references public.templates(id) on delete set null,
  overlay jsonb not null default '{"gradient":true,"darken":0.5,"color":"#000000","textColor":"#ffffff"}'::jsonb,
  show_counter boolean not null default true,
  created_at timestamptz not null default now()
);

create index user_slide_presets_user_id_idx on public.user_slide_presets(user_id);

alter table public.user_slide_presets enable row level security;

create policy "user_slide_presets_select_own"
  on public.user_slide_presets for select
  using (user_id = auth.uid());

create policy "user_slide_presets_insert_own"
  on public.user_slide_presets for insert
  with check (user_id = auth.uid());

create policy "user_slide_presets_update_own"
  on public.user_slide_presets for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_slide_presets_delete_own"
  on public.user_slide_presets for delete
  using (user_id = auth.uid());
