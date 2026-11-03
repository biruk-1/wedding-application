# Documents, profile & settings (Task 11)

## Documents

- Route: `/(app)/weddings/[weddingId]/documents`
- Table: `wedding_files` (PM baseline: `display_name`, `storage_path`, `uploaded_by`, optional `task_id` / `booking_id`)
- Bucket: private `wedding-documents` (path `{wedding_id}/{file_id}/{name}`)
- Access: members can read; writers upload/delete/rename via RLS + signed URLs
- **Not in schema:** file size, mime type, category columns — kind is inferred from extension; size is validated on upload only

### Migration required

`supabase/migrations/20260401120000_storage_and_file_update.sql` adds:

1. Storage buckets `wedding-documents` (private) and `avatars` (public read)
2. Storage RLS policies
3. `wedding_files` **UPDATE** policy (rename `display_name`)

Apply with `npm run db:reset` (local) after review. No PM table columns were changed.

## Profile & settings

- Routes under `/(app)/weddings/[weddingId]/settings`
- Editable: `display_name`, `phone`, `avatar_url`
- Read-only email from auth session
- Change password via `supabase.auth.updateUser`
- Language / appearance / push toggles are explained as unavailable until translations / themes / notification backend exist

## Notifications

**Not implemented in-app.** See [notifications-proposal.md](./notifications-proposal.md).
