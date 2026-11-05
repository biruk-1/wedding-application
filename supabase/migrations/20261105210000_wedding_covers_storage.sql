-- Additive: public wedding cover photos for dashboard hero.
-- Path convention: wedding-covers/{wedding_id}/cover.{ext}
-- Uses existing weddings.cover_image_url (no table schema change).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'wedding-covers',
    'wedding-covers',
    true,
    5242880, -- 5 MiB
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy wedding_covers_public_select on storage.objects
  for select to public
  using (bucket_id = 'wedding-covers');

create policy wedding_covers_insert_writer on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wedding-covers'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );

create policy wedding_covers_update_writer on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wedding-covers'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'wedding-covers'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );

create policy wedding_covers_delete_writer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wedding-covers'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );
