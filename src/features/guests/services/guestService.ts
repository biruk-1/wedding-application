import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/lib/query/queryError';
import { mapGuestError } from '@/features/guests/services/guestErrors';
import {
  GUEST_GROUP_COLUMNS,
  GUEST_LIST_SELECT,
  GUEST_SUMMARY_COLUMNS,
} from '@/features/guests/services/guestSelects';
import type {
  Guest,
  GuestGroup,
  GuestGroupInput,
  GuestInput,
  GuestListItem,
  GuestListPage,
  GuestServerFilters,
  GuestSummary,
} from '@/features/guests/types';
import { buildGuestSearchFilter, escapeIlikeLiteral } from '@/features/guests/utils/guestHelpers';
import type { Database } from '@/types/database.types';

export const GUEST_PAGE_SIZE = 40;
const SUMMARY_PAGE_SIZE = 1000;
const SUMMARY_MAX_PAGES = 10;

type GuestResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): GuestResult<never> {
  return { ok: false, error: mapGuestError(error) };
}

function notFound(message: string): GuestResult<never> {
  return { ok: false, error: { code: 'not_found', message } };
}

// --- Groups ----------------------------------------------------------------------------------

export async function listGuestGroups(
  weddingId: string,
  signal?: AbortSignal,
): Promise<GuestResult<GuestGroup[]>> {
  let query = supabase
    .from('guest_groups')
    .select(GUEST_GROUP_COLUMNS)
    .eq('wedding_id', weddingId)
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as unknown as GuestGroup[] };
}

export async function createGuestGroup(
  weddingId: string,
  input: GuestGroupInput,
): Promise<GuestResult<GuestGroup>> {
  const { data, error } = await supabase
    .from('guest_groups')
    .insert({
      wedding_id: weddingId,
      name: input.name.trim(),
      side: input.side ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(GUEST_GROUP_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as GuestGroup };
}

export async function updateGuestGroup(
  weddingId: string,
  groupId: string,
  input: Partial<GuestGroupInput>,
): Promise<GuestResult<GuestGroup>> {
  const patch: Database['public']['Tables']['guest_groups']['Update'] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.side !== undefined) patch.side = input.side;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from('guest_groups')
    .update(patch)
    .eq('id', groupId)
    .eq('wedding_id', weddingId)
    .select(GUEST_GROUP_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return notFound('This group could not be updated. It may have been removed, or you may not have permission.');
  }
  return { ok: true, data: data as unknown as GuestGroup };
}

/**
 * `invitations.group_id` is ON DELETE SET NULL, but the table also requires guest_id OR group_id.
 * Invitations addressed only to this group would violate that CHECK and block the delete, so they
 * are removed first (their links stop working). Invitations that also name a guest survive.
 */
export async function deleteGuestGroup(weddingId: string, groupId: string): Promise<GuestResult<true>> {
  const cleanup = await supabase
    .from('invitations')
    .delete()
    .eq('wedding_id', weddingId)
    .eq('group_id', groupId)
    .is('guest_id', null);
  if (cleanup.error) return fail(cleanup.error);

  const { error } = await supabase
    .from('guest_groups')
    .delete()
    .eq('id', groupId)
    .eq('wedding_id', weddingId);
  if (error) return fail(error);
  return { ok: true, data: true };
}

// --- Guests ----------------------------------------------------------------------------------

type RawGuestListRow = Guest & {
  group: GuestListItem['group'] | NonNullable<GuestListItem['group']>[] | null;
};

function normalizeGuest(row: RawGuestListRow): GuestListItem {
  const { group, ...guest } = row;
  return { ...guest, group: Array.isArray(group) ? (group[0] ?? null) : group };
}

/**
 * One page of guests, ordered by name. Search is a server-side ilike over name/email/phone and
 * the group filter is applied in SQL. One extra row is requested to learn whether more exist.
 */
export async function listGuests(
  weddingId: string,
  filters: GuestServerFilters,
  page = 0,
  signal?: AbortSignal,
): Promise<GuestResult<GuestListPage>> {
  const from = page * GUEST_PAGE_SIZE;
  let query = supabase
    .from('guests')
    .select(GUEST_LIST_SELECT)
    .eq('wedding_id', weddingId)
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + GUEST_PAGE_SIZE);

  if (filters.groupId) query = query.eq('group_id', filters.groupId);
  const search = buildGuestSearchFilter(filters.query);
  if (search) query = query.or(search);
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) return fail(error);

  const rows = ((data ?? []) as unknown as RawGuestListRow[]).map(normalizeGuest);
  return {
    ok: true,
    data: { items: rows.slice(0, GUEST_PAGE_SIZE), hasMore: rows.length > GUEST_PAGE_SIZE },
  };
}

/**
 * Every guest of the wedding with only the columns stats, pickers and seating need. Pages through
 * PostgREST's row cap so large guest lists are not silently truncated.
 */
export async function listGuestSummaries(
  weddingId: string,
  signal?: AbortSignal,
): Promise<GuestResult<GuestSummary[]>> {
  const all: GuestSummary[] = [];
  for (let page = 0; page < SUMMARY_MAX_PAGES; page += 1) {
    const from = page * SUMMARY_PAGE_SIZE;
    let query = supabase
      .from('guests')
      .select(GUEST_SUMMARY_COLUMNS)
      .eq('wedding_id', weddingId)
      .order('full_name', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + SUMMARY_PAGE_SIZE - 1);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    if (error) return fail(error);
    const rows = (data ?? []) as unknown as GuestSummary[];
    all.push(...rows);
    if (rows.length < SUMMARY_PAGE_SIZE) break;
  }
  return { ok: true, data: all };
}

/** Scoped to the wedding in the URL so a guest id from another wedding never renders here. */
export async function getGuest(
  weddingId: string,
  guestId: string,
  signal?: AbortSignal,
): Promise<GuestResult<GuestListItem>> {
  let query = supabase
    .from('guests')
    .select(GUEST_LIST_SELECT)
    .eq('id', guestId)
    .eq('wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Guest not found or unavailable.');
  return { ok: true, data: normalizeGuest(data as unknown as RawGuestListRow) };
}

/** Soft duplicate check: same wedding, same name and same email (only when an email is given). */
async function findDuplicateGuest(
  weddingId: string,
  fullName: string,
  email: string | null | undefined,
  excludeGuestId?: string,
): Promise<GuestResult<boolean>> {
  if (!email) return { ok: true, data: false };
  let query = supabase
    .from('guests')
    .select('id')
    .eq('wedding_id', weddingId)
    .ilike('full_name', escapeIlikeLiteral(fullName.trim()))
    .ilike('email', escapeIlikeLiteral(email.trim()))
    .limit(1);
  if (excludeGuestId) query = query.neq('id', excludeGuestId);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []).length > 0 };
}

const DUPLICATE_GUEST: GuestResult<never> = {
  ok: false,
  error: {
    code: 'duplicate_guest',
    message: 'A guest with this name and email is already on your list.',
  },
};

function guestPatch(input: Partial<GuestInput>): Database['public']['Tables']['guests']['Update'] {
  const patch: Database['public']['Tables']['guests']['Update'] = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName.trim();
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null;
  if (input.groupId !== undefined) patch.group_id = input.groupId;
  if (input.side !== undefined) patch.side = input.side;
  if (input.guestType !== undefined) patch.guest_type = input.guestType;
  if (input.plusOneAllowed !== undefined) patch.plus_one_allowed = input.plusOneAllowed;
  if (input.dietaryNotes !== undefined) patch.dietary_notes = input.dietaryNotes?.trim() || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  return patch;
}

export async function createGuest(
  weddingId: string,
  input: GuestInput,
): Promise<GuestResult<GuestListItem>> {
  const duplicate = await findDuplicateGuest(weddingId, input.fullName, input.email);
  if (!duplicate.ok) return duplicate;
  if (duplicate.data) return DUPLICATE_GUEST;

  const { data, error } = await supabase
    .from('guests')
    .insert({
      wedding_id: weddingId,
      full_name: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      email: input.email?.trim().toLowerCase() || null,
      group_id: input.groupId ?? null,
      side: input.side ?? null,
      guest_type: input.guestType ?? null,
      plus_one_allowed: input.plusOneAllowed ?? false,
      dietary_notes: input.dietaryNotes?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select(GUEST_LIST_SELECT)
    .single();
  if (error) return fail(error);
  return { ok: true, data: normalizeGuest(data as unknown as RawGuestListRow) };
}

export async function updateGuest(
  weddingId: string,
  guestId: string,
  input: Partial<GuestInput>,
): Promise<GuestResult<GuestListItem>> {
  if (input.fullName !== undefined || input.email !== undefined) {
    // The duplicate check needs both parts, so fill the missing one from the stored row.
    const current = await supabase
      .from('guests')
      .select('full_name, email')
      .eq('id', guestId)
      .eq('wedding_id', weddingId)
      .maybeSingle();
    if (current.error) return fail(current.error);
    if (!current.data) return notFound('Guest not found or unavailable.');
    const fullName = input.fullName ?? current.data.full_name;
    const email = input.email !== undefined ? input.email : current.data.email;
    const duplicate = await findDuplicateGuest(weddingId, fullName, email, guestId);
    if (!duplicate.ok) return duplicate;
    if (duplicate.data) return DUPLICATE_GUEST;
  }

  const { data, error } = await supabase
    .from('guests')
    .update(guestPatch(input))
    .eq('id', guestId)
    .eq('wedding_id', weddingId)
    .select(GUEST_LIST_SELECT)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return notFound('This guest could not be updated. They may have been removed, or you may not have permission.');
  }
  return { ok: true, data: normalizeGuest(data as unknown as RawGuestListRow) };
}

/**
 * `invitations.guest_id` is ON DELETE SET NULL; an invitation addressed only to this guest
 * (no group) would violate the guest_id OR group_id CHECK and block the delete, so it is removed
 * first. Invitations that also name a group stay and simply lose the guest reference.
 */
export async function deleteGuest(weddingId: string, guestId: string): Promise<GuestResult<true>> {
  const cleanup = await supabase
    .from('invitations')
    .delete()
    .eq('wedding_id', weddingId)
    .eq('guest_id', guestId)
    .is('group_id', null);
  if (cleanup.error) return fail(cleanup.error);

  const { error } = await supabase.from('guests').delete().eq('id', guestId).eq('wedding_id', weddingId);
  if (error) return fail(error);
  return { ok: true, data: true };
}
