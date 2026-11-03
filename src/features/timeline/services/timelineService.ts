import { mapTimelineError } from '@/features/timeline/services/timelineErrors';
import {
  EVENT_COLUMNS,
  TIMELINE_ITEM_COLUMNS,
  TIMELINE_ITEM_LIST_SELECT,
} from '@/features/timeline/services/timelineSelects';
import type {
  EventInput,
  RelatedBooking,
  RelatedTask,
  TimelineItem,
  TimelineItemInput,
  TimelineItemWithAssignee,
  WeddingEvent,
} from '@/features/timeline/types';
import type { ServiceResult } from '@/lib/query/queryError';
import { supabase } from '@/lib/supabase';

type TimelineResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): TimelineResult<never> {
  return { ok: false, error: mapTimelineError(error) };
}

function notFound(message: string): TimelineResult<never> {
  return { ok: false, error: { code: 'not_found', message } };
}

type EmbedOne<T> = T | T[] | null;

function one<T>(value: EmbedOne<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// --- Events ----------------------------------------------------------------------------------

export async function listWeddingEvents(
  weddingId: string,
  signal?: AbortSignal,
): Promise<TimelineResult<WeddingEvent[]>> {
  let query = supabase
    .from('wedding_events')
    .select(EVENT_COLUMNS)
    .eq('wedding_id', weddingId)
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as WeddingEvent[] };
}

export async function getWeddingEvent(
  weddingId: string,
  eventId: string,
  signal?: AbortSignal,
): Promise<TimelineResult<WeddingEvent>> {
  let query = supabase
    .from('wedding_events')
    .select(EVENT_COLUMNS)
    .eq('id', eventId)
    .eq('wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Event not found or unavailable.');
  return { ok: true, data: data as WeddingEvent };
}

export async function createWeddingEvent(
  weddingId: string,
  input: EventInput,
): Promise<TimelineResult<WeddingEvent>> {
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
      event_type: input.eventType.trim() || 'other',
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      venue_name: input.venueName?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
      sort_order: input.sortOrder ?? count ?? 0,
    })
    .select(EVENT_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as WeddingEvent };
}

export async function updateWeddingEvent(
  weddingId: string,
  eventId: string,
  input: EventInput,
): Promise<TimelineResult<WeddingEvent>> {
  const { data, error } = await supabase
    .from('wedding_events')
    .update({
      name: input.name.trim(),
      event_type: input.eventType.trim() || 'other',
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      venue_name: input.venueName?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      notes: input.notes?.trim() || null,
      ...(input.sortOrder != null ? { sort_order: input.sortOrder } : {}),
    })
    .eq('id', eventId)
    .eq('wedding_id', weddingId)
    .select(EVENT_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Event not found or unavailable.');
  return { ok: true, data: data as WeddingEvent };
}

export async function deleteWeddingEvent(
  weddingId: string,
  eventId: string,
): Promise<TimelineResult<true>> {
  const { data, error } = await supabase
    .from('wedding_events')
    .delete()
    .eq('id', eventId)
    .eq('wedding_id', weddingId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return notFound('Event not found or unavailable.');
  return { ok: true, data: true };
}

// --- Timeline items (wedding-day schedule for an event) --------------------------------------

export async function listTimelineItems(
  eventId: string,
  signal?: AbortSignal,
): Promise<TimelineResult<TimelineItemWithAssignee[]>> {
  let query = supabase
    .from('timeline_items')
    .select(TIMELINE_ITEM_LIST_SELECT)
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);

  const rows = ((data ?? []) as unknown as (TimelineItem & {
    assignee: EmbedOne<{ id: string; display_name: string }>;
  })[]).map((row) => ({
    ...row,
    assignee: one(row.assignee),
  }));
  return { ok: true, data: rows };
}

export async function createTimelineItem(
  eventId: string,
  input: TimelineItemInput,
): Promise<TimelineResult<TimelineItem>> {
  const { count, error: countError } = await supabase
    .from('timeline_items')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (countError) return fail(countError);

  const { data, error } = await supabase
    .from('timeline_items')
    .insert({
      event_id: eventId,
      title: input.title.trim(),
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      notes: input.notes?.trim() || null,
      assigned_to: input.assignedTo || null,
      sort_order: input.sortOrder ?? count ?? 0,
    })
    .select(TIMELINE_ITEM_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as TimelineItem };
}

export async function updateTimelineItem(
  eventId: string,
  itemId: string,
  input: TimelineItemInput,
): Promise<TimelineResult<TimelineItem>> {
  const { data, error } = await supabase
    .from('timeline_items')
    .update({
      title: input.title.trim(),
      starts_at: input.startsAt ?? null,
      ends_at: input.endsAt ?? null,
      notes: input.notes?.trim() || null,
      assigned_to: input.assignedTo || null,
      ...(input.sortOrder != null ? { sort_order: input.sortOrder } : {}),
    })
    .eq('id', itemId)
    .eq('event_id', eventId)
    .select(TIMELINE_ITEM_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Timeline item not found or unavailable.');
  return { ok: true, data: data as TimelineItem };
}

export async function deleteTimelineItem(
  eventId: string,
  itemId: string,
): Promise<TimelineResult<true>> {
  const { data, error } = await supabase
    .from('timeline_items')
    .delete()
    .eq('id', itemId)
    .eq('event_id', eventId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return notFound('Timeline item not found or unavailable.');
  return { ok: true, data: true };
}

/** Persist a new sort_order for each item (reorder). */
export async function reorderTimelineItems(
  eventId: string,
  orderedIds: string[],
): Promise<TimelineResult<true>> {
  for (let index = 0; index < orderedIds.length; index += 1) {
    const { error } = await supabase
      .from('timeline_items')
      .update({ sort_order: index })
      .eq('id', orderedIds[index])
      .eq('event_id', eventId);
    if (error) return fail(error);
  }
  return { ok: true, data: true };
}

// --- Related planning info -------------------------------------------------------------------

export async function listRelatedTasks(
  weddingId: string,
  eventId: string,
  signal?: AbortSignal,
): Promise<TimelineResult<RelatedTask[]>> {
  let query = supabase
    .from('wedding_tasks')
    .select('id, title, status, due_date')
    .eq('wedding_id', weddingId)
    .eq('event_id', eventId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as RelatedTask[] };
}

/**
 * Confirmed (or fulfilled) bookings for wedding vendors linked to this event.
 * Inquiries are never included. Bookings have no direct event_id — link is via wedding_vendors.
 */
export async function listRelatedBookings(
  weddingId: string,
  eventId: string,
  signal?: AbortSignal,
): Promise<TimelineResult<RelatedBooking[]>> {
  let query = supabase
    .from('wedding_vendors')
    .select(
      `id, status,
       vendor:vendors ( business_name ),
       bookings:vendor_bookings ( id, status, booking_date, start_at, end_at, notes )`,
    )
    .eq('wedding_id', weddingId)
    .eq('event_id', eventId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);

  const results: RelatedBooking[] = [];
  for (const row of data ?? []) {
    const vendor = one(row.vendor as EmbedOne<{ business_name: string }>);
    const bookings = (row.bookings as
      | {
          id: string;
          status: string;
          booking_date: string | null;
          start_at: string | null;
          end_at: string | null;
          notes: string | null;
        }[]
      | null) ?? [];
    for (const booking of bookings) {
      if (booking.status !== 'confirmed' && booking.status !== 'fulfilled') continue;
      results.push({
        id: booking.id,
        status: booking.status,
        booking_date: booking.booking_date,
        start_at: booking.start_at,
        end_at: booking.end_at,
        notes: booking.notes,
        vendorName: vendor?.business_name ?? 'Vendor',
        weddingVendorId: row.id,
      });
    }
  }
  return { ok: true, data: results };
}
