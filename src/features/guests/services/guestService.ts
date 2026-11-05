import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/lib/query/queryError';
import { mapGuestError } from '@/features/guests/services/guestErrors';
import {
  GUEST_GROUP_COLUMNS,
  GUEST_SUMMARY_COLUMNS,
} from '@/features/guests/services/guestSelects';
import type {
  GuestGroup,
  GuestGroupInput,
  GuestInput,
  GuestListItem,
  GuestListPage,
  GuestServerFilters,
  GuestStats,
  GuestSummary,
} from '@/features/guests/types';
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

function parseGuestRow(raw: unknown): GuestListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.wedding_id !== 'string' || typeof row.full_name !== 'string') {
    return null;
  }
  const groupRaw = row.group;
  let group: GuestListItem['group'] = null;
  if (groupRaw && typeof groupRaw === 'object') {
    const g = groupRaw as Record<string, unknown>;
    if (typeof g.id === 'string') {
      group = { id: g.id, name: typeof g.name === 'string' ? g.name : '' };
    }
  }
  return {
    id: row.id,
    wedding_id: row.wedding_id,
    group_id: typeof row.group_id === 'string' ? row.group_id : null,
    full_name: row.full_name,
    phone: typeof row.phone === 'string' ? row.phone : null,
    email: typeof row.email === 'string' ? row.email : null,
    side: (typeof row.side === 'string' ? row.side : null) as GuestListItem['side'],
    guest_type: (typeof row.guest_type === 'string' ? row.guest_type : null) as GuestListItem['guest_type'],
    plus_one_allowed: Boolean(row.plus_one_allowed),
    dietary_notes: typeof row.dietary_notes === 'string' ? row.dietary_notes : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    updated_by: typeof row.updated_by === 'string' ? row.updated_by : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    group,
    created_by_name: typeof row.created_by_name === 'string' ? row.created_by_name : null,
    updated_by_name: typeof row.updated_by_name === 'string' ? row.updated_by_name : null,
    contacts_visible: row.contacts_visible !== false,
  };
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

/** Owner/manage_all: create Bride's / Groom's family groups when missing (D10). */
export async function ensureFamilyGuestGroups(
  weddingId: string,
): Promise<GuestResult<{ partnerOneGroupId: string; partnerTwoGroupId: string; createdSides: string[] }>> {
  const { data, error } = await supabase.rpc('ensure_family_guest_groups', {
    p_wedding_id: weddingId,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') return fail(new Error('No family groups returned'));
  const row = data as Record<string, unknown>;
  const created = Array.isArray(row.created_sides)
    ? row.created_sides.filter((item): item is string => typeof item === 'string')
    : [];
  if (typeof row.partner_one_group_id !== 'string' || typeof row.partner_two_group_id !== 'string') {
    return fail(new Error('Family groups incomplete'));
  }
  return {
    ok: true,
    data: {
      partnerOneGroupId: row.partner_one_group_id,
      partnerTwoGroupId: row.partner_two_group_id,
      createdSides: created,
    },
  };
}

export async function deleteGuestGroup(weddingId: string, groupId: string): Promise<GuestResult<true>> {
  const { error } = await supabase.rpc('delete_guest_group', {
    p_wedding_id: weddingId,
    p_group_id: groupId,
  });
  if (error) return fail(error);
  return { ok: true, data: true };
}

// --- Guests ----------------------------------------------------------------------------------

export async function listGuests(
  weddingId: string,
  filters: GuestServerFilters,
  page = 0,
  _signal?: AbortSignal,
): Promise<GuestResult<GuestListPage>> {
  const { data, error } = await supabase.rpc('list_wedding_guests', {
    p_wedding_id: weddingId,
    p_query: filters.query || undefined,
    p_group_id: filters.groupId ?? undefined,
    p_limit: GUEST_PAGE_SIZE,
    p_offset: page * GUEST_PAGE_SIZE,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') return { ok: true, data: { items: [], hasMore: false } };
  const row = data as Record<string, unknown>;
  const itemsRaw = Array.isArray(row.items) ? row.items : [];
  return {
    ok: true,
    data: {
      items: itemsRaw.map(parseGuestRow).filter((item): item is GuestListItem => item !== null),
      hasMore: Boolean(row.has_more),
    },
  };
}

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

export async function getGuestStats(
  weddingId: string,
  eventId?: string | null,
): Promise<GuestResult<GuestStats>> {
  const { data, error } = await supabase.rpc('get_guest_stats', {
    p_wedding_id: weddingId,
    p_event_id: eventId ?? undefined,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') {
    return { ok: true, data: { total: 0, yes: 0, no: 0, maybe: 0, pending: 0, plusOnesAllowed: 0 } };
  }
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      total: Number(row.total ?? 0),
      yes: Number(row.yes ?? 0),
      no: Number(row.no ?? 0),
      maybe: Number(row.maybe ?? 0),
      pending: Number(row.pending ?? 0),
      plusOnesAllowed: Number(row.plus_ones_allowed ?? 0),
    },
  };
}

export async function getGuest(
  weddingId: string,
  guestId: string,
  _signal?: AbortSignal,
): Promise<GuestResult<GuestListItem>> {
  const { data, error } = await supabase.rpc('get_wedding_guest', {
    p_wedding_id: weddingId,
    p_guest_id: guestId,
  });
  if (error) return fail(error);
  const guest = parseGuestRow(data);
  if (!guest) return notFound('Guest not found or unavailable.');
  return { ok: true, data: guest };
}

async function findDuplicateGuest(
  weddingId: string,
  fullName: string,
  email: string | null | undefined,
  excludeGuestId?: string,
): Promise<GuestResult<boolean>> {
  if (!email) return { ok: true, data: false };
  const { data, error } = await supabase.rpc('guest_name_email_taken', {
    p_wedding_id: weddingId,
    p_full_name: fullName.trim(),
    p_email: email.trim(),
    p_exclude_guest_id: excludeGuestId ?? undefined,
  });
  if (error) return fail(error);
  return { ok: true, data: Boolean(data) };
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
    .select('id')
    .single();
  if (error) return fail(error);
  return getGuest(weddingId, data.id);
}

export async function updateGuest(
  weddingId: string,
  guestId: string,
  input: Partial<GuestInput>,
): Promise<GuestResult<GuestListItem>> {
  if (input.fullName !== undefined || input.email !== undefined) {
    const current = await getGuest(weddingId, guestId);
    if (!current.ok) return current;
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
    .select('id')
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return notFound('This guest could not be updated. They may have been removed, or you may not have permission.');
  }
  return getGuest(weddingId, guestId);
}

export async function deleteGuest(weddingId: string, guestId: string): Promise<GuestResult<true>> {
  const { error } = await supabase.rpc('delete_guest', {
    p_wedding_id: weddingId,
    p_guest_id: guestId,
  });
  if (error) return fail(error);
  return { ok: true, data: true };
}
