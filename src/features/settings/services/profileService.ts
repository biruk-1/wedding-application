import { AVATARS_BUCKET } from '@/features/documents/types';
import type { Profile, ProfileUpdateInput } from '@/features/settings/types';
import type { ServiceResult } from '@/lib/query/queryError';
import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';
import { supabase } from '@/lib/supabase';

type ProfileResult<T> = ServiceResult<T>;

function mapProfileError(error: { message?: string; code?: string } | Error | null) {
  if (!error) return { code: 'unknown', message: 'Could not update your profile.' };
  const transport = transportErrorCode(error);
  if (transport) return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  if (message.includes('row-level security') || ('code' in error && error.code === '42501')) {
    return { code: 'forbidden', message: 'You can only edit your own profile.' };
  }
  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code : 'unknown',
    message:
      'message' in error && typeof error.message === 'string' && error.message
        ? error.message
        : 'Could not update your profile.',
  };
}

function fail(error: { message?: string; code?: string } | Error | null): ProfileResult<never> {
  return { ok: false, error: mapProfileError(error) };
}

export async function getMyProfile(
  userId: string,
  signal?: AbortSignal,
): Promise<ProfileResult<Profile>> {
  let query = supabase
    .from('profiles')
    .select('id, display_name, phone, avatar_url, preferred_language, created_at, updated_at')
    .eq('id', userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return fail({ code: 'not_found', message: 'Profile not found.' });
  return { ok: true, data: data as Profile };
}

export async function updateMyProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<ProfileResult<Profile>> {
  const patch: DatabaseProfilesUpdate = {
    display_name: input.displayName.trim(),
    phone: input.phone?.trim() ? input.phone.trim() : null,
    updated_at: new Date().toISOString(),
  };
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('id, display_name, phone, avatar_url, preferred_language, created_at, updated_at')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return fail({ code: 'not_found', message: 'Profile not found.' });
  return { ok: true, data: data as Profile };
}

type DatabaseProfilesUpdate = {
  display_name?: string;
  phone?: string | null;
  avatar_url?: string | null;
  updated_at?: string;
};

export async function uploadAvatar(input: {
  userId: string;
  uri: string;
  mimeType?: string | null;
}): Promise<ProfileResult<{ publicUrl: string }>> {
  const ext = mimeToExt(input.mimeType);
  const path = `${input.userId}/avatar.${ext}`;

  const response = await fetch(input.uri);
  if (!response.ok) return fail(new Error('Could not read the selected photo.'));
  const blob = await response.blob();
  if (blob.size > 5 * 1024 * 1024) {
    return fail({ code: 'too_large', message: 'Choose a photo under 5 MB.' });
  }

  const { error: uploadError } = await supabase.storage.from(AVATARS_BUCKET).upload(path, blob, {
    contentType: input.mimeType ?? `image/${ext}`,
    upsert: true,
  });
  if (uploadError) return fail(uploadError);

  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
  return { ok: true, data: { publicUrl } };
}

function mimeToExt(mime: string | null | undefined): 'jpg' | 'png' | 'webp' {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}
