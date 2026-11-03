import { supabase } from '@/lib/supabase';
import type { ServiceResult } from '@/lib/query/queryError';
import { mapGuestError } from '@/features/guests/services/guestErrors';
import {
  SEATING_ASSIGNMENT_COLUMNS,
  SEATING_TABLE_COLUMNS,
} from '@/features/guests/services/guestSelects';
import type { SeatingAssignment, SeatingTable, SeatingTableInput } from '@/features/guests/types';
import { hasSeatAvailable } from '@/features/guests/utils/guestHelpers';

type SeatingResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): SeatingResult<never> {
  return { ok: false, error: mapGuestError(error) };
}

export async function listTables(
  eventId: string,
  signal?: AbortSignal,
): Promise<SeatingResult<SeatingTable[]>> {
  let query = supabase
    .from('seating_tables')
    .select(SEATING_TABLE_COLUMNS)
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as unknown as SeatingTable[] };
}

export async function createTable(
  eventId: string,
  input: SeatingTableInput,
): Promise<SeatingResult<SeatingTable>> {
  const { count, error: countError } = await supabase
    .from('seating_tables')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId);
  if (countError) return fail(countError);

  const { data, error } = await supabase
    .from('seating_tables')
    .insert({
      event_id: eventId,
      name: input.name.trim(),
      capacity: input.capacity ?? null,
      sort_order: count ?? 0,
    })
    .select(SEATING_TABLE_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as SeatingTable };
}

export async function updateTable(
  eventId: string,
  tableId: string,
  input: Partial<SeatingTableInput>,
): Promise<SeatingResult<SeatingTable>> {
  const patch: { name?: string; capacity?: number | null } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.capacity !== undefined) patch.capacity = input.capacity;

  const { data, error } = await supabase
    .from('seating_tables')
    .update(patch)
    .eq('id', tableId)
    .eq('event_id', eventId)
    .select(SEATING_TABLE_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return {
      ok: false,
      error: {
        code: 'not_found',
        message: 'This table could not be updated. It may have been removed, or you may not have permission.',
      },
    };
  }
  return { ok: true, data: data as unknown as SeatingTable };
}

/** Assignments for the table cascade (seating_assignments.table_id ON DELETE CASCADE). */
export async function deleteTable(eventId: string, tableId: string): Promise<SeatingResult<true>> {
  const { error } = await supabase
    .from('seating_tables')
    .delete()
    .eq('id', tableId)
    .eq('event_id', eventId);
  if (error) return fail(error);
  return { ok: true, data: true };
}

export async function listAssignments(
  eventId: string,
  signal?: AbortSignal,
): Promise<SeatingResult<SeatingAssignment[]>> {
  let query = supabase
    .from('seating_assignments')
    .select(SEATING_ASSIGNMENT_COLUMNS)
    .eq('event_id', eventId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as unknown as SeatingAssignment[] };
}

/**
 * Seats a guest at a table for an event, moving them if already seated elsewhere. Capacity is
 * checked client-side first (the schema has no server-side capacity constraint), counting the
 * table's current assignments; a guest already at this table does not count against it.
 */
export async function assignGuest(input: {
  eventId: string;
  tableId: string;
  guestId: string;
}): Promise<SeatingResult<SeatingAssignment>> {
  const [tableResult, assignmentsResult] = await Promise.all([
    supabase
      .from('seating_tables')
      .select('id, capacity, name')
      .eq('id', input.tableId)
      .eq('event_id', input.eventId)
      .maybeSingle(),
    supabase
      .from('seating_assignments')
      .select('guest_id')
      .eq('table_id', input.tableId)
      .eq('event_id', input.eventId),
  ]);
  if (tableResult.error) return fail(tableResult.error);
  if (assignmentsResult.error) return fail(assignmentsResult.error);
  if (!tableResult.data) {
    return { ok: false, error: { code: 'not_found', message: 'That table no longer exists.' } };
  }

  const seated = assignmentsResult.data ?? [];
  const alreadyHere = seated.some((row) => row.guest_id === input.guestId);
  if (!alreadyHere && !hasSeatAvailable(tableResult.data.capacity, seated.length)) {
    return {
      ok: false,
      error: {
        code: 'table_full',
        message: `${tableResult.data.name} is full (${tableResult.data.capacity} seats). Choose another table or raise its capacity.`,
      },
    };
  }

  const { data, error } = await supabase
    .from('seating_assignments')
    .upsert(
      { event_id: input.eventId, guest_id: input.guestId, table_id: input.tableId, seat_number: null },
      { onConflict: 'event_id,guest_id' },
    )
    .select(SEATING_ASSIGNMENT_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as unknown as SeatingAssignment };
}

export async function unassignGuest(eventId: string, guestId: string): Promise<SeatingResult<true>> {
  const { error } = await supabase
    .from('seating_assignments')
    .delete()
    .eq('event_id', eventId)
    .eq('guest_id', guestId);
  if (error) return fail(error);
  return { ok: true, data: true };
}
