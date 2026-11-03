import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/lib/query/queryError';
import { mapGuestError } from '@/features/guests/services/guestErrors';
import {
  DESIGN_COLUMNS,
  EVENT_COLUMNS,
  INVITATION_COLUMNS,
  INVITATION_LIST_SELECT,
  RSVP_COLUMNS,
} from '@/features/guests/services/guestSelects';
import type {
  CreateInvitationInput,
  CreatedInvitation,
  DesignData,
  GuestRsvp,
  Invitation,
  InvitationDesign,
  InvitationDesignInput,
  InvitationListItem,
  PublicInviteEvent,
  PublicInviteGuest,
  PublicInvitePreview,
  RsvpResponse,
  WeddingEvent,
  WeddingEventInput,
} from '@/features/guests/types';
import { parseDesignData } from '@/features/guests/utils/guestHelpers';
import type { Json } from '@/types/database.types';

type InvitationResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): InvitationResult<never> {
  return { ok: false, error: mapGuestError(error) };
}

function notFound(message: string): InvitationResult<never> {
  return { ok: false, error: { code: 'not_found', message } };
}

// --- Designs ---------------------------------------------------------------------------------

/** Drops `undefined` keys so only intentional values are written to the jsonb column. */
function serializeDesignData(data: DesignData): Json {
  const clean: Record<string, string> = {};
  if (data.title) clean.title = data.title;
  if (data.message) clean.message = data.message;
  if (data.accent) clean.accent = data.accent;
  if (data.layout) clean.layout = data.layout;
  return clean;
}

export async function listInvitationDesigns(
  weddingId: string,
  signal?: AbortSignal,
): Promise<InvitationResult<InvitationDesign[]>> {
  let query = supabase
    .from('invitation_designs')
    .select(DESIGN_COLUMNS)
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as unknown as InvitationDesign[] };
}

export async function createInvitationDesign(
  weddingId: string,
  input: InvitationDesignInput,
): Promise<InvitationResult<InvitationDesign>> {
  const { data, error } = await supabase
    .from('invitation_designs')
    .insert({
      wedding_id: weddingId,
      name: input.name.trim(),
      design_data: serializeDesignData(input.designData) as NonNullable<Json>,
    })
    .select(DESIGN_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as InvitationDesign };
}

export async function updateInvitationDesign(
  weddingId: string,
  designId: string,
  input: InvitationDesignInput,
): Promise<InvitationResult<InvitationDesign>> {
  const { data, error } = await supabase
    .from('invitation_designs')
    .update({
      name: input.name.trim(),
      design_data: serializeDesignData(input.designData) as NonNullable<Json>,
    })
    .eq('id', designId)
    .eq('wedding_id', weddingId)
    .select(DESIGN_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return notFound('This design could not be updated. It may have been removed, or you may not have permission.');
  }
  return { ok: true, data: data as unknown as InvitationDesign };
}

// --- Invitations -----------------------------------------------------------------------------

type EmbedOne<T> = T | T[] | null;

type RawInvitationRow = Invitation & {
  guest: EmbedOne<NonNullable<InvitationListItem['guest']>>;
  group: EmbedOne<NonNullable<InvitationListItem['group']>>;
  design: EmbedOne<NonNullable<InvitationListItem['design']>>;
  events: { event_id: string }[] | null;
};

function one<T>(value: EmbedOne<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeInvitation(row: RawInvitationRow): InvitationListItem {
  const { guest, group, design, events, ...invitation } = row;
  return {
    ...invitation,
    guest: one(guest),
    group: one(group),
    design: one(design),
    event_ids: (events ?? []).map((item) => item.event_id),
  };
}

/** Strips any `token_hash` an RPC row carries so it never reaches app state. */
function toInvitation(row: Record<string, unknown>): Invitation {
  return {
    id: row.id as string,
    wedding_id: row.wedding_id as string,
    group_id: (row.group_id as string | null) ?? null,
    guest_id: (row.guest_id as string | null) ?? null,
    design_id: (row.design_id as string | null) ?? null,
    delivery_channel: (row.delivery_channel as string | null) ?? null,
    status: row.status as string,
    sent_at: (row.sent_at as string | null) ?? null,
    delivered_at: (row.delivered_at as string | null) ?? null,
    opened_at: (row.opened_at as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

/** Explicit column list: `token_hash` is never requested. */
export async function listInvitations(
  weddingId: string,
  signal?: AbortSignal,
): Promise<InvitationResult<InvitationListItem[]>> {
  let query = supabase
    .from('invitations')
    .select(INVITATION_LIST_SELECT)
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return {
    ok: true,
    data: ((data ?? []) as unknown as RawInvitationRow[]).map(normalizeInvitation),
  };
}

/**
 * Creates an invitation via the `create_guest_invitation` RPC. The raw token is returned exactly
 * once and cannot be read again; callers keep it in memory only and must never log or store it.
 */
export async function createInvitation(
  input: CreateInvitationInput,
): Promise<InvitationResult<CreatedInvitation>> {
  const { data, error } = await supabase.rpc('create_guest_invitation', {
    p_wedding_id: input.weddingId,
    p_guest_id: input.guestId ?? undefined,
    p_group_id: input.groupId ?? undefined,
    p_design_id: input.designId ?? undefined,
    p_event_ids: input.eventIds && input.eventIds.length > 0 ? input.eventIds : undefined,
    p_delivery_channel: 'link',
  });
  if (error) return fail(error);
  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.invitation_id || !row.raw_token) {
    return { ok: false, error: { code: 'unknown', message: 'Could not create the invitation. Please try again.' } };
  }
  return { ok: true, data: { invitationId: row.invitation_id, rawToken: row.raw_token } };
}

/**
 * Records that the planner shared the link. This is NOT delivery: no SMS/email provider exists,
 * so `delivered` is never set by the app.
 */
export async function markInvitationSent(invitationId: string): Promise<InvitationResult<Invitation>> {
  const { data, error } = await supabase.rpc('mark_guest_invitation_sent', {
    p_invitation_id: invitationId,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return notFound('Invitation not found or unavailable.');
  }
  return { ok: true, data: toInvitation(data as Record<string, unknown>) };
}

export async function cancelInvitation(
  weddingId: string,
  invitationId: string,
): Promise<InvitationResult<Invitation>> {
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('wedding_id', weddingId)
    .select(INVITATION_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return notFound('This invitation could not be cancelled. It may have been removed, or you may not have permission.');
  }
  return { ok: true, data: data as unknown as Invitation };
}

// --- Events ----------------------------------------------------------------------------------

export async function listWeddingEvents(
  weddingId: string,
  signal?: AbortSignal,
): Promise<InvitationResult<WeddingEvent[]>> {
  let query = supabase
    .from('wedding_events')
    .select(EVENT_COLUMNS)
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true })
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as unknown as WeddingEvent[] };
}

/** Minimal event: a name and a type (defaults to a ceremony). Dates and venue can come later. */
export async function createWeddingEvent(
  weddingId: string,
  input: WeddingEventInput,
): Promise<InvitationResult<WeddingEvent>> {
  const { count, error: countError } = await supabase
    .from('wedding_events')
    .select('id', { count: 'exact', head: true })
    .eq('wedding_id', weddingId);
  if (countError) return fail(countError);

  const { data, error } = await supabase
    .from('wedding_events')
    .insert({
      wedding_id: weddingId,
      name: input.name.trim(),
      event_type: input.eventType ?? 'ceremony',
      sort_order: count ?? 0,
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as WeddingEvent };
}

// --- RSVPs (planner view) --------------------------------------------------------------------

/** RSVPs for every guest of the wedding, scoped through an inner join on `guests.wedding_id`. */
export async function listRsvpsForWedding(
  weddingId: string,
  signal?: AbortSignal,
): Promise<InvitationResult<GuestRsvp[]>> {
  let query = supabase
    .from('guest_rsvps')
    .select(`${RSVP_COLUMNS}, guest:guests!inner ( wedding_id )`)
    .eq('guest.wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);

  const rows = ((data ?? []) as unknown as (GuestRsvp & { guest?: unknown })[]).map((row) => ({
    guest_id: row.guest_id,
    event_id: row.event_id,
    response: row.response,
    responded_at: row.responded_at,
    attendance_checked_in_at: row.attendance_checked_in_at,
  }));
  return { ok: true, data: rows };
}

/** Planner sets (or corrects) a guest's RSVP; an upsert on the (guest_id, event_id) primary key. */
export async function setGuestRsvp(
  guestId: string,
  eventId: string,
  response: RsvpResponse,
): Promise<InvitationResult<GuestRsvp>> {
  const { data, error } = await supabase
    .from('guest_rsvps')
    .upsert(
      {
        guest_id: guestId,
        event_id: eventId,
        response,
        responded_at: response === 'pending' ? null : new Date().toISOString(),
      },
      { onConflict: 'guest_id,event_id' },
    )
    .select(RSVP_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as GuestRsvp };
}

// --- Public token RPCs -----------------------------------------------------------------------

const RESPONSES: readonly string[] = ['pending', 'yes', 'no', 'maybe'];

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseEvents(value: unknown): PublicInviteEvent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return [];
    return [
      {
        id: raw.id,
        name: raw.name,
        event_type: asString(raw.event_type) ?? 'other',
        starts_at: asString(raw.starts_at),
        venue_name: asString(raw.venue_name),
        city: asString(raw.city),
      },
    ];
  });
}

function parseGuests(value: unknown): PublicInviteGuest[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.full_name !== 'string') return [];
    const rsvps = Array.isArray(raw.rsvps)
      ? raw.rsvps.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return [];
          const r = entry as Record<string, unknown>;
          if (typeof r.event_id !== 'string') return [];
          const response = RESPONSES.includes(String(r.response)) ? (r.response as RsvpResponse) : 'pending';
          return [{ event_id: r.event_id, response, responded_at: asString(r.responded_at) }];
        })
      : [];
    return [
      { id: raw.id, full_name: raw.full_name, plus_one_allowed: raw.plus_one_allowed === true, rsvps },
    ];
  });
}

/** Defensive parse of the RPC's jsonb; returns null when the shape is not an invitation. */
export function parseInvitePreview(value: unknown): PublicInvitePreview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.invitation_id !== 'string') return null;
  const wedding = (raw.wedding && typeof raw.wedding === 'object' ? raw.wedding : {}) as Record<string, unknown>;
  const design =
    raw.design && typeof raw.design === 'object' ? (raw.design as Record<string, unknown>) : null;

  return {
    invitation_id: raw.invitation_id,
    status: (asString(raw.status) ?? 'sent') as PublicInvitePreview['status'],
    opened_at: asString(raw.opened_at),
    wedding: {
      title: asString(wedding.title) ?? '',
      partner_one_name: asString(wedding.partner_one_name) ?? '',
      partner_two_name: asString(wedding.partner_two_name) ?? '',
      wedding_date: asString(wedding.wedding_date),
      city: asString(wedding.city),
      country_code: asString(wedding.country_code),
    },
    design:
      design && typeof design.id === 'string'
        ? {
            id: design.id,
            name: asString(design.name) ?? '',
            design_data: parseDesignData(design.design_data),
          }
        : null,
    events: parseEvents(raw.events),
    guests: parseGuests(raw.guests),
  };
}

/** Works signed out: the RPC is granted to `anon`. The raw token is only sent, never logged. */
export async function getInvitationPreviewByToken(
  rawToken: string,
  signal?: AbortSignal,
): Promise<InvitationResult<PublicInvitePreview>> {
  let request = supabase.rpc('get_guest_invitation_by_token', { p_raw_token: rawToken });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) return fail(error);
  const preview = parseInvitePreview(data);
  if (!preview) {
    return { ok: false, error: { code: 'invalid_token', message: 'This invitation link is not valid.' } };
  }
  return { ok: true, data: preview };
}

export async function submitRsvpByToken(input: {
  rawToken: string;
  guestId: string;
  eventId: string;
  response: RsvpResponse;
}): Promise<InvitationResult<GuestRsvp>> {
  const { data, error } = await supabase.rpc('submit_guest_invitation_rsvp', {
    p_raw_token: input.rawToken,
    p_guest_id: input.guestId,
    p_event_id: input.eventId,
    p_response: input.response,
  });
  if (error) return fail(error);
  if (!data) return notFound('Could not save your response. Please try again.');
  return { ok: true, data: data as unknown as GuestRsvp };
}
