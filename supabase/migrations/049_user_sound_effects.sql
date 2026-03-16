-- User-uploaded sound effects for video generation (up to 7s audio, or audio extracted from video).
-- Stored in carousel-assets: user/{user_id}/sound-effects/{id}.wav
create table public.user_sound_effects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  duration_sec numeric(5,2) not null,
  role text not null check (role in ('intro', 'transition')),
  created_at timestamptz not null default now()
);

create index user_sound_effects_user_id_idx on public.user_sound_effects(user_id);

alter table public.user_sound_effects enable row level security;

create policy "user_sound_effects_select_own"
  on public.user_sound_effects for select
  using (user_id = auth.uid());

create policy "user_sound_effects_insert_own"
  on public.user_sound_effects for insert
  with check (user_id = auth.uid());

create policy "user_sound_effects_update_own"
  on public.user_sound_effects for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_sound_effects_delete_own"
  on public.user_sound_effects for delete
  using (user_id = auth.uid());

comment on table public.user_sound_effects is 'User-uploaded audio (≤7s) for video intro/transition sound effects; audio can be extracted from video on upload.';
