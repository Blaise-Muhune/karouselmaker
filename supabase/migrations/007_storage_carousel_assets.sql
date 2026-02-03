-- carousel-assets bucket: private, owner-scoped paths
insert into storage.buckets (id, name, public)
values ('carousel-assets', 'carousel-assets', false)
on conflict (id) do nothing;

-- Owner-only access: path must be user/{auth.uid()}/*
create policy "carousel_assets_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'carousel-assets'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

create policy "carousel_assets_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'carousel-assets'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

create policy "carousel_assets_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'carousel-assets'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (auth.uid())::text
  )
  with check (
    bucket_id = 'carousel-assets'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );

create policy "carousel_assets_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'carousel-assets'
    and (storage.foldername(name))[1] = 'user'
    and (storage.foldername(name))[2] = (auth.uid())::text
  );
