-- Task 11 (documents / avatars): Storage buckets + wedding_files rename policy.
-- Review before applying. Does not alter PM baseline table columns.
-- Path conventions:
--   wedding-documents: {wedding_id}/{file_id}/{sanitized_filename}
--   avatars:           {user_id}/avatar.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'wedding-documents',
    'wedding-documents',
    false,
    20971520, -- 20 MiB
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]
  ),
  (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MiB
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Allow wedding writers to rename display_name (and optional task/booking links).
create policy wedding_files_update on public.wedding_files
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));

-- ---------------------------------------------------------------------------
-- Storage: wedding-documents (private; membership via first path segment)
-- ---------------------------------------------------------------------------

create policy wedding_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.is_wedding_member((storage.foldername(name))[1]::uuid)
  );

create policy wedding_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wedding-documents'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );

create policy wedding_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'wedding-documents'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );

create policy wedding_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.can_write_wedding((storage.foldername(name))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- Storage: avatars (public read; users write only their own folder)
-- ---------------------------------------------------------------------------

create policy avatars_public_select on storage.objects
  for select to public
  using (bucket_id = 'avatars');

create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
