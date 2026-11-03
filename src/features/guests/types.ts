import type { Database } from '@/types/database.types';

type Tables = Database['public']['Tables'];

export type Guest = Tables['guests']['Row'];
export type GuestGroup = Tables['guest_groups']['Row'];
export type InvitationDesign = Tables['invitation_designs']['Row'];
export type GuestRsvp = Tables['guest_rsvps']['Row'];
export type SeatingTable = Tables['seating_tables']['Row'];
export type SeatingAssignment = Tables['seating_assignments']['Row'];
export type WeddingEvent = Tables['wedding_events']['Row'];

/**
 * App-facing invitation. `token_hash` exists in the generated table type but is never selected
 * (column SELECT is revoked from API roles) and is stripped from RPC results, so it is omitted here.
 */
export type Invitation = Omit<Tables['invitations']['Row'], 'token_hash'>;

export type GuestSide = 'partner_one' | 'partner_two' | 'both' | 'other';
export type GuestType = 'family' | 'friend' | 'coworker' | 'other';
export type RsvpResponse = 'pending' | 'yes' | 'no' | 'maybe';
export type InvitationStatus = 'draft' | 'ready' | 'sent' | 'delivered' | 'opened' | 'cancelled';
export type DeliveryChannel = 'link' | 'sms' | 'whatsapp' | 'email' | 'print' | 'other';

/** Guest row plus the embedded group name used by the list. */
export type GuestListItem = Guest & { group: Pick<GuestGroup, 'id' | 'name'> | null };

/** Minimal guest columns for pickers, stats and seating (no PII beyond the name). */
export type GuestSummary = Pick<Guest, 'id' | 'full_name' | 'group_id' | 'side' | 'plus_one_allowed'>;

export type GuestListPage = { items: GuestListItem[]; hasMore: boolean };

/**
 * Invitation row plus the names needed to render tracking rows.
 * `event_ids` come from the `invitation_events` junction (not an audit log).
 */
export type InvitationListItem = Invitation & {
  guest: Pick<Guest, 'id' | 'full_name'> | null;
  group: Pick<GuestGroup, 'id' | 'name'> | null;
  design: Pick<InvitationDesign, 'id' | 'name'> | null;
  event_ids: string[];
};

/**
 * Convention for `invitation_designs.design_data` (jsonb). Stored in the database only; there is
 * no seeded design catalogue and `storage_path` is unused (no storage bucket yet).
 */
export type DesignLayout = 'classic' | 'floral' | 'modern';

export type DesignData = {
  title?: string;
  message?: string;
  /** Hex colour, `#RGB` or `#RRGGBB`. */
  accent?: string;
  layout?: DesignLayout;
};

export const DESIGN_LAYOUTS: readonly DesignLayout[] = ['classic', 'floral', 'modern'];

// --- Filters ---------------------------------------------------------------------------------

/** Filters sent to the server (and used in the query key). */
export type GuestServerFilters = {
  query: string;
  groupId: string | null;
};

export type GuestRsvpFilter = 'all' | RsvpResponse;

/** All guest list filters; the RSVP status filter is applied client-side on loaded rows. */
export type GuestFilters = GuestServerFilters & {
  rsvp: GuestRsvpFilter;
  /** Event the RSVP filter and stats refer to; null means "any event". */
  eventId: string | null;
};

export type GuestStats = {
  total: number;
  yes: number;
  no: number;
  maybe: number;
  pending: number;
  /** Guests with `plus_one_allowed = true` (the schema has no accompanying-guest count). */
  plusOnesAllowed: number;
};

export type InvitationFilter = 'all' | InvitationStatus;

export type InvitationSummary = Record<InvitationStatus, number> & { total: number };

// --- Public invitation preview (get_guest_invitation_by_token) --------------------------------

export type PublicInviteEvent = {
  id: string;
  name: string;
  event_type: string;
  starts_at: string | null;
  venue_name: string | null;
  city: string | null;
};

export type PublicInviteRsvp = {
  event_id: string;
  response: RsvpResponse;
  responded_at: string | null;
};

export type PublicInviteGuest = {
  id: string;
  full_name: string;
  plus_one_allowed: boolean;
  rsvps: PublicInviteRsvp[];
};

export type PublicInvitePreview = {
  invitation_id: string;
  status: InvitationStatus;
  opened_at: string | null;
  wedding: {
    title: string;
    partner_one_name: string;
    partner_two_name: string;
    wedding_date: string | null;
    city: string | null;
    country_code: string | null;
  };
  design: { id: string; name: string; design_data: DesignData } | null;
  events: PublicInviteEvent[];
  guests: PublicInviteGuest[];
};

// --- Service inputs --------------------------------------------------------------------------

export type GuestInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  groupId?: string | null;
  side?: GuestSide | null;
  guestType?: GuestType | null;
  plusOneAllowed?: boolean;
  dietaryNotes?: string | null;
  notes?: string | null;
};

export type GuestGroupInput = {
  name: string;
  side?: GuestSide | null;
  notes?: string | null;
};

export type InvitationDesignInput = {
  name: string;
  designData: DesignData;
};

export type WeddingEventInput = {
  name: string;
  eventType?: string;
};

export type SeatingTableInput = {
  name: string;
  capacity?: number | null;
};

export type CreateInvitationInput = {
  weddingId: string;
  guestId?: string | null;
  groupId?: string | null;
  designId?: string | null;
  eventIds?: string[];
};

/** Raw token is returned once at creation. Hold it in memory only; never log or persist it. */
export type CreatedInvitation = { invitationId: string; rawToken: string };
