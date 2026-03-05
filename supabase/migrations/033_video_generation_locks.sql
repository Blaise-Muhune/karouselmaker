-- One video generation at a time per user (e.g. avoid multiple FFmpeg in parallel across tabs).
create table public.video_generation_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locked_until timestamptz not null default now()
);

alter table public.video_generation_locks enable row level security;

create policy "video_generation_locks_select_own"
  on public.video_generation_locks for select
  using (user_id = auth.uid());

create policy "video_generation_locks_insert_own"
  on public.video_generation_locks for insert
  with check (user_id = auth.uid());

create policy "video_generation_locks_update_own"
  on public.video_generation_locks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "video_generation_locks_delete_own"
  on public.video_generation_locks for delete
  using (user_id = auth.uid());

-- Atomic acquire: returns true if lock acquired, false if another tab/session holds it.
create or replace function public.acquire_video_gen_lock(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  acquired boolean;
begin
  with upserted as (
    insert into public.video_generation_locks (user_id, locked_until)
    values (p_user_id, now() + interval '10 minutes')
    on conflict (user_id) do update
    set locked_until = now() + interval '10 minutes'
    where public.video_generation_locks.locked_until <= now()
    returning 1
  )
  select exists(select 1 from upserted) into acquired;
  return acquired;
end;
$$;

-- Release lock for user (call when video generation finishes or fails).
create or replace function public.release_video_gen_lock(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.video_generation_locks
  set locked_until = now()
  where user_id = p_user_id;
end;
$$;

grant execute on function public.acquire_video_gen_lock(uuid) to authenticated;
grant execute on function public.release_video_gen_lock(uuid) to authenticated;
