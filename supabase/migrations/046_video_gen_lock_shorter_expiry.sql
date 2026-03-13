-- Shorten video generation lock expiry from 10 to 3 minutes so a stuck lock (e.g. tab closed, error before release) clears sooner.
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
    values (p_user_id, now() + interval '3 minutes')
    on conflict (user_id) do update
    set locked_until = now() + interval '3 minutes'
    where public.video_generation_locks.locked_until <= now()
    returning 1
  )
  select exists(select 1 from upserted) into acquired;
  return acquired;
end;
$$;
