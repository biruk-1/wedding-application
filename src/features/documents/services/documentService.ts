import { mapDocumentError } from '@/features/documents/services/documentErrors';
import {
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
  WEDDING_DOCUMENTS_BUCKET,
  type WeddingFileListItem,
} from '@/features/documents/types';
import {
  buildDocumentStoragePath,
  sanitizeFileName,
} from '@/features/documents/utils/fileHelpers';
import type { ServiceResult } from '@/lib/query/queryError';
import { supabase } from '@/lib/supabase';

type DocResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): DocResult<never> {
  return { ok: false, error: mapDocumentError(error) };
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const LIST_SELECT = `
  id, wedding_id, display_name, storage_path, created_at, uploaded_by, task_id, booking_id,
  uploader:profiles!wedding_files_uploaded_by_fkey ( id, display_name )
`;

export async function listWeddingFiles(
  weddingId: string,
  signal?: AbortSignal,
): Promise<DocResult<WeddingFileListItem[]>> {
  let query = supabase
    .from('wedding_files')
    .select(LIST_SELECT)
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);

  const items: WeddingFileListItem[] = (data ?? []).map((row) => {
    const r = row as typeof row & {
      uploader: { id: string; display_name: string } | { id: string; display_name: string }[] | null;
    };
    return {
      id: r.id,
      wedding_id: r.wedding_id,
      display_name: r.display_name,
      storage_path: r.storage_path,
      created_at: r.created_at,
      uploaded_by: r.uploaded_by,
      task_id: r.task_id,
      booking_id: r.booking_id,
      uploader: one(r.uploader),
    };
  });
  return { ok: true, data: items };
}

export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 60 * 10,
): Promise<DocResult<{ url: string }>> {
  const { data, error } = await supabase.storage
    .from(WEDDING_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) return fail(error);
  if (!data?.signedUrl) return fail(new Error('Could not create a secure download link.'));
  return { ok: true, data: { url: data.signedUrl } };
}

export type UploadDocumentInput = {
  weddingId: string;
  userId: string;
  displayName: string;
  mimeType: string | null;
  /** Local URI from the document picker (file:// or content://). */
  uri: string;
  size?: number | null;
  /** When available (web / some platforms), raw bytes as base64. */
  base64?: string | null;
  taskId?: string | null;
  bookingId?: string | null;
  onProgress?: (ratio: number) => void;
};

export async function uploadWeddingDocument(
  input: UploadDocumentInput,
): Promise<DocResult<WeddingFileListItem>> {
  const displayName = sanitizeFileName(input.displayName);
  const mime = input.mimeType ?? 'application/octet-stream';

  if (input.size != null && input.size > MAX_DOCUMENT_BYTES) {
    return fail({ code: 'too_large', message: 'That file is too large. Use a file under 20 MB.' });
  }
  if (mime !== 'application/octet-stream' && !ALLOWED_DOCUMENT_MIME.has(mime)) {
    return fail({ code: 'unsupported', message: 'That file type is not supported.' });
  }

  const fileId = cryptoRandomId();
  const storagePath = buildDocumentStoragePath(input.weddingId, fileId, displayName);
  input.onProgress?.(0.05);

  const body = await readUploadBody(input.uri, input.base64);
  if (!body.ok) return body;

  input.onProgress?.(0.35);

  const { error: uploadError } = await supabase.storage
    .from(WEDDING_DOCUMENTS_BUCKET)
    .upload(storagePath, body.data, {
      contentType: mime,
      upsert: false,
    });
  if (uploadError) return fail(uploadError);

  input.onProgress?.(0.75);

  const { data, error } = await supabase
    .from('wedding_files')
    .insert({
      id: fileId,
      wedding_id: input.weddingId,
      uploaded_by: input.userId,
      display_name: displayName,
      storage_path: storagePath,
      task_id: input.taskId ?? null,
      booking_id: input.bookingId ?? null,
    })
    .select(LIST_SELECT)
    .single();

  if (error) {
    // Best-effort cleanup so orphaned objects do not accumulate.
    await supabase.storage.from(WEDDING_DOCUMENTS_BUCKET).remove([storagePath]);
    return fail(error);
  }

  input.onProgress?.(1);
  const uploader = one(
    (data as { uploader: { id: string; display_name: string } | { id: string; display_name: string }[] | null })
      .uploader,
  );
  return {
    ok: true,
    data: {
      id: data.id,
      wedding_id: data.wedding_id,
      display_name: data.display_name,
      storage_path: data.storage_path,
      created_at: data.created_at,
      uploaded_by: data.uploaded_by,
      task_id: data.task_id,
      booking_id: data.booking_id,
      uploader,
    },
  };
}

export async function renameWeddingDocument(
  weddingId: string,
  fileId: string,
  displayName: string,
): Promise<DocResult<WeddingFileListItem>> {
  const name = sanitizeFileName(displayName);
  if (!name) return fail({ code: 'validation', message: 'Enter a file name.' });

  const { data, error } = await supabase
    .from('wedding_files')
    .update({ display_name: name })
    .eq('id', fileId)
    .eq('wedding_id', weddingId)
    .select(LIST_SELECT)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return fail({ code: 'not_found', message: 'Document not found or unavailable.' });

  return {
    ok: true,
    data: {
      id: data.id,
      wedding_id: data.wedding_id,
      display_name: data.display_name,
      storage_path: data.storage_path,
      created_at: data.created_at,
      uploaded_by: data.uploaded_by,
      task_id: data.task_id,
      booking_id: data.booking_id,
      uploader: one(
        (data as { uploader: { id: string; display_name: string } | { id: string; display_name: string }[] | null })
          .uploader,
      ),
    },
  };
}

export async function deleteWeddingDocument(
  weddingId: string,
  file: Pick<WeddingFileListItem, 'id' | 'storage_path'>,
): Promise<DocResult<true>> {
  const { error: dbError } = await supabase
    .from('wedding_files')
    .delete()
    .eq('id', file.id)
    .eq('wedding_id', weddingId);
  if (dbError) return fail(dbError);

  const { error: storageError } = await supabase.storage
    .from(WEDDING_DOCUMENTS_BUCKET)
    .remove([file.storage_path]);
  // DB row is already gone; surface storage cleanup failure as soft warning via log-free result.
  if (storageError) {
    return fail({
      code: 'storage_cleanup',
      message: 'Document removed, but the stored file could not be cleaned up. Try again later.',
    });
  }
  return { ok: true, data: true };
}

function cryptoRandomId(): string {
  // RN / modern JS
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/^data:[^;]+;base64,/, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = normalized.replace(/[^A-Za-z0-9+/=]/g, '');
  const output: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = chars.indexOf(clean[i] ?? '');
    const enc2 = chars.indexOf(clean[i + 1] ?? '');
    const enc3 = chars.indexOf(clean[i + 2] ?? '=');
    const enc4 = chars.indexOf(clean[i + 3] ?? '=');
    const bitmap = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);
    output.push((bitmap >> 16) & 255);
    if (enc3 !== 64 && clean[i + 2] !== '=') output.push((bitmap >> 8) & 255);
    if (enc4 !== 64 && clean[i + 3] !== '=') output.push(bitmap & 255);
  }
  return Uint8Array.from(output).buffer;
}

async function readUploadBody(
  uri: string,
  base64?: string | null,
): Promise<DocResult<ArrayBuffer | Blob>> {
  if (base64) {
    try {
      return { ok: true, data: base64ToArrayBuffer(base64) };
    } catch (error) {
      return fail(error instanceof Error ? error : new Error('Could not read file data.'));
    }
  }

  try {
    const response = await fetch(uri);
    if (!response.ok) {
      return fail(new Error('Could not read the selected file.'));
    }
    const blob = await response.blob();
    if (blob.size > MAX_DOCUMENT_BYTES) {
      return fail({ code: 'too_large', message: 'That file is too large. Use a file under 20 MB.' });
    }
    return { ok: true, data: blob };
  } catch (error) {
    return fail(error instanceof Error ? error : new Error('Could not read the selected file.'));
  }
}
