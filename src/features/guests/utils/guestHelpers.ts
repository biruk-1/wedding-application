import {
  DESIGN_LAYOUTS,
  type DesignData,
  type DesignLayout,
  type GuestRsvp,
  type GuestRsvpFilter,
  type GuestSide,
  type GuestStats,
  type GuestType,
  type InvitationFilter,
  type InvitationStatus,
  type InvitationSummary,
  type RsvpResponse,
  type SeatingAssignment,
  type SeatingTable,
} from '@/features/guests/types';

// --- Search ----------------------------------------------------------------------------------

/**
 * Cleans free text before it goes into a PostgREST `or(...ilike...)` filter. Wildcards, quotes and
 * backslashes are stripped so users cannot widen the pattern or break out of the quoted value.
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%*\\"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** `or` filter string matching name, email or phone; null when there is nothing to search. */
export function buildGuestSearchFilter(raw: string): string | null {
  const term = sanitizeSearchTerm(raw);
  if (!term) return null;
  const pattern = `"*${term}*"`;
  return `full_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`;
}

/** Escapes `%`, `_` and `\` so a value matches literally in an `ilike` with no wildcards. */
export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// --- RSVP status, filtering and stats -------------------------------------------------------

type RsvpLike = Pick<GuestRsvp, 'guest_id' | 'event_id' | 'response'>;

/** Collapses a guest's responses across events: yes > maybe > no, otherwise pending. */
export function overallRsvpStatus(responses: readonly string[]): RsvpResponse {
  if (responses.includes('yes')) return 'yes';
  if (responses.includes('maybe')) return 'maybe';
  if (responses.includes('no')) return 'no';
  return 'pending';
}

function normalizeResponse(value: string | undefined): RsvpResponse {
  return value === 'yes' || value === 'no' || value === 'maybe' ? value : 'pending';
}

function groupRsvpsByGuest(rsvps: readonly RsvpLike[]): Map<string, RsvpLike[]> {
  const byGuest = new Map<string, RsvpLike[]>();
  for (const rsvp of rsvps) {
    const list = byGuest.get(rsvp.guest_id);
    if (list) list.push(rsvp);
    else byGuest.set(rsvp.guest_id, [rsvp]);
  }
  return byGuest;
}

function statusForGuest(
  guestRsvps: readonly RsvpLike[] | undefined,
  eventId: string | null | undefined,
): RsvpResponse {
  if (!guestRsvps || guestRsvps.length === 0) return 'pending';
  if (eventId) {
    return normalizeResponse(guestRsvps.find((rsvp) => rsvp.event_id === eventId)?.response);
  }
  return overallRsvpStatus(guestRsvps.map((rsvp) => rsvp.response));
}

/** RSVP status of one guest for an event (or across all events when `eventId` is null). */
export function guestRsvpStatus(
  guestId: string,
  rsvps: readonly RsvpLike[],
  eventId: string | null | undefined,
): RsvpResponse {
  return statusForGuest(
    rsvps.filter((rsvp) => rsvp.guest_id === guestId),
    eventId,
  );
}

/** RSVP status for many guests in one pass (O(guests + rsvps)); used to badge list rows. */
export function buildRsvpStatusMap(
  guests: readonly { id: string }[],
  rsvps: readonly RsvpLike[],
  eventId: string | null | undefined,
): Map<string, RsvpResponse> {
  const byGuest = groupRsvpsByGuest(rsvps);
  const result = new Map<string, RsvpResponse>();
  for (const guest of guests) {
    result.set(guest.id, statusForGuest(byGuest.get(guest.id), eventId));
  }
  return result;
}

type FilterableGuest = { id: string; full_name: string; group_id: string | null; email?: string | null; phone?: string | null };

export type ClientGuestFilter = {
  rsvp?: GuestRsvpFilter;
  eventId?: string | null;
  query?: string;
  groupId?: string | null;
};

/**
 * Client-side filter over already-loaded guests. RSVP status is only known client-side, so this
 * is where the RSVP filter lives; `query`/`groupId` mirror the server filters for loaded data.
 */
export function filterGuests<T extends FilterableGuest>(
  guests: readonly T[],
  rsvps: readonly RsvpLike[],
  filter: ClientGuestFilter,
): T[] {
  const rsvpFilter = filter.rsvp ?? 'all';
  const term = filter.query?.trim().toLowerCase() ?? '';
  const byGuest = rsvpFilter === 'all' ? null : groupRsvpsByGuest(rsvps);

  return guests.filter((guest) => {
    if (filter.groupId && guest.group_id !== filter.groupId) return false;
    if (term) {
      const haystack = [guest.full_name, guest.email ?? '', guest.phone ?? ''].join(' ').toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (byGuest) {
      return statusForGuest(byGuest.get(guest.id), filter.eventId) === rsvpFilter;
    }
    return true;
  });
}

/**
 * RSVP counts for a guest list. With an `eventId` it counts that event's response (no row means
 * pending); without one each guest is counted once using their strongest response across events.
 */
export function computeGuestStats(input: {
  guests: readonly { id: string; plus_one_allowed?: boolean }[];
  rsvps: readonly RsvpLike[];
  eventId?: string | null;
}): GuestStats {
  const byGuest = groupRsvpsByGuest(input.rsvps);
  const stats: GuestStats = { total: 0, yes: 0, no: 0, maybe: 0, pending: 0, plusOnesAllowed: 0 };

  for (const guest of input.guests) {
    stats.total += 1;
    if (guest.plus_one_allowed) stats.plusOnesAllowed += 1;
    stats[statusForGuest(byGuest.get(guest.id), input.eventId)] += 1;
  }
  return stats;
}

// --- Labels ----------------------------------------------------------------------------------

const RSVP_LABELS: Record<RsvpResponse, string> = {
  pending: 'Pending',
  yes: 'Attending',
  no: 'Declined',
  maybe: 'Maybe',
};

export function rsvpLabel(response: RsvpResponse): string {
  return RSVP_LABELS[response];
}

export function rsvpTone(response: RsvpResponse): 'neutral' | 'success' | 'danger' | 'warning' {
  if (response === 'yes') return 'success';
  if (response === 'no') return 'danger';
  if (response === 'maybe') return 'warning';
  return 'neutral';
}

export const GUEST_SIDES: readonly GuestSide[] = ['partner_one', 'partner_two', 'both', 'other'];
export const GUEST_TYPES: readonly GuestType[] = ['family', 'friend', 'coworker', 'other'];

const SIDE_LABELS: Record<GuestSide, string> = {
  partner_one: 'Partner one',
  partner_two: 'Partner two',
  both: 'Both',
  other: 'Other',
};

export function sideLabel(side: string | null | undefined): string {
  return side && side in SIDE_LABELS ? SIDE_LABELS[side as GuestSide] : 'Not set';
}

const TYPE_LABELS: Record<GuestType, string> = {
  family: 'Family',
  friend: 'Friend',
  coworker: 'Work',
  other: 'Other',
};

export function guestTypeLabel(type: string | null | undefined): string {
  if (!type) return 'Not set';
  return type in TYPE_LABELS ? TYPE_LABELS[type as GuestType] : type;
}

const STATUS_LABELS: Record<InvitationStatus, string> = {
  draft: 'Draft',
  ready: 'Ready to share',
  sent: 'Shared',
  delivered: 'Delivered',
  opened: 'Opened',
  cancelled: 'Cancelled',
};

export const INVITATION_STATUSES: readonly InvitationStatus[] = [
  'draft',
  'ready',
  'sent',
  'delivered',
  'opened',
  'cancelled',
];

export function invitationStatusLabel(status: string): string {
  return STATUS_LABELS[status as InvitationStatus] ?? status;
}

export function invitationStatusTone(
  status: string,
): 'neutral' | 'success' | 'danger' | 'warning' | 'info' | 'primary' {
  switch (status) {
    case 'opened':
      return 'success';
    case 'delivered':
      return 'info';
    case 'sent':
      return 'primary';
    case 'ready':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

// --- Invitations -----------------------------------------------------------------------------

/** Counts by the real `status` column; nothing is inferred or invented. */
export function summarizeInvitations(invitations: readonly { status: string }[]): InvitationSummary {
  const summary: InvitationSummary = {
    total: 0,
    draft: 0,
    ready: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    cancelled: 0,
  };
  for (const invitation of invitations) {
    summary.total += 1;
    if (invitation.status in summary) summary[invitation.status as InvitationStatus] += 1;
  }
  return summary;
}

export function filterInvitations<T extends { status: string }>(
  invitations: readonly T[],
  filter: InvitationFilter,
): T[] {
  return filter === 'all' ? [...invitations] : invitations.filter((item) => item.status === filter);
}

// --- Design data -----------------------------------------------------------------------------

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim());
}

export const DEFAULT_ACCENT = '#C5A36A';

/** Reads untrusted jsonb into a safe `DesignData`; unknown or malformed keys are dropped. */
export function parseDesignData(value: unknown): DesignData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const result: DesignData = {};
  if (typeof raw.title === 'string' && raw.title.trim()) result.title = raw.title.trim().slice(0, 120);
  if (typeof raw.message === 'string' && raw.message.trim()) {
    result.message = raw.message.trim().slice(0, 600);
  }
  if (isHexColor(raw.accent)) result.accent = raw.accent.trim();
  if (typeof raw.layout === 'string' && (DESIGN_LAYOUTS as readonly string[]).includes(raw.layout)) {
    result.layout = raw.layout as DesignLayout;
  }
  return result;
}

// --- Seating ---------------------------------------------------------------------------------

export type TableOccupancy = {
  table: SeatingTable;
  assigned: number;
  /** null when the table has no capacity limit. */
  remaining: number | null;
  isFull: boolean;
  isOverCapacity: boolean;
};

export function tableOccupancy(
  tables: readonly SeatingTable[],
  assignments: readonly Pick<SeatingAssignment, 'table_id'>[],
): TableOccupancy[] {
  const counts = new Map<string, number>();
  for (const assignment of assignments) {
    counts.set(assignment.table_id, (counts.get(assignment.table_id) ?? 0) + 1);
  }
  return tables.map((table) => {
    const assigned = counts.get(table.id) ?? 0;
    const capacity = table.capacity;
    return {
      table,
      assigned,
      remaining: capacity == null ? null : Math.max(0, capacity - assigned),
      isFull: capacity != null && assigned >= capacity,
      isOverCapacity: capacity != null && assigned > capacity,
    };
  });
}

/** True when one more guest would not exceed the table capacity (always true when unlimited). */
export function hasSeatAvailable(capacity: number | null, assignedCount: number): boolean {
  return capacity == null || assignedCount < capacity;
}
