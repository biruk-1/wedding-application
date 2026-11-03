import type { Database } from '@/types/database.types';

export type WeddingFile = Database['public']['Tables']['wedding_files']['Row'];

export type WeddingFileListItem = Pick<
  WeddingFile,
  'id' | 'wedding_id' | 'display_name' | 'storage_path' | 'created_at' | 'uploaded_by' | 'task_id' | 'booking_id'
> & {
  uploader: { id: string; display_name: string } | null;
};

export type DocumentKind = 'pdf' | 'image' | 'sheet' | 'doc' | 'text' | 'other';

export const WEDDING_DOCUMENTS_BUCKET = 'wedding-documents';
export const AVATARS_BUCKET = 'avatars';

/** Client-side limits (bucket also enforces 20 MiB). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
