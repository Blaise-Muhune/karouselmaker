-- exports: export jobs/results per carousel
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  format text not null default 'png',
  status text not null default 'pending',
  storage_path text,
  created_at timestamptz not null default now()
);

create index exports_carousel_id_idx on public.exports(carousel_id);

alter table public.exports enable row level security;

create policy "exports_select_own_carousel"
  on public.exports for select
  using (
    exists (
      select 1 from public.carousels c
      where c.id = exports.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "exports_insert_own_carousel"
  on public.exports for insert
  with check (
    exists (
      select 1 from public.carousels c
      where c.id = exports.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "exports_update_own_carousel"
  on public.exports for update
  using (
    exists (
      select 1 from public.carousels c
      where c.id = exports.carousel_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carousels c
      where c.id = exports.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "exports_delete_own_carousel"
  on public.exports for delete
  using (
    exists (
      select 1 from public.carousels c
      where c.id = exports.carousel_id and c.user_id = auth.uid()
    )
  );
