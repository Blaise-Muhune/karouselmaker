-- slides: individual slides belonging to a carousel
create table public.slides (
  id uuid primary key default gen_random_uuid(),
  carousel_id uuid not null references public.carousels(id) on delete cascade,
  slide_index int not null,
  slide_type text not null,
  headline text not null,
  body text,
  template_id uuid references public.templates(id) on delete set null,
  background jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(carousel_id, slide_index)
);

create index slides_carousel_id_idx on public.slides(carousel_id);
create index slides_template_id_idx on public.slides(template_id);

alter table public.slides enable row level security;

create policy "slides_select_own_carousel"
  on public.slides for select
  using (
    exists (
      select 1 from public.carousels c
      where c.id = slides.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "slides_insert_own_carousel"
  on public.slides for insert
  with check (
    exists (
      select 1 from public.carousels c
      where c.id = slides.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "slides_update_own_carousel"
  on public.slides for update
  using (
    exists (
      select 1 from public.carousels c
      where c.id = slides.carousel_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.carousels c
      where c.id = slides.carousel_id and c.user_id = auth.uid()
    )
  );

create policy "slides_delete_own_carousel"
  on public.slides for delete
  using (
    exists (
      select 1 from public.carousels c
      where c.id = slides.carousel_id and c.user_id = auth.uid()
    )
  );
