/**
 * Explicit column lists (never `*`). Shared with the integration tests.
 * `invitations` deliberately omits `token_hash`: it is not selectable by API roles and the app
 * must never request it.
 */
export const GUEST_COLUMNS =
  'id, wedding_id, group_id, full_name, phone, email, side, guest_type, plus_one_allowed, dietary_notes, notes, created_at';

/** Guest row plus the embedded group used by the list. */
export const GUEST_LIST_SELECT = `${GUEST_COLUMNS}, group:guest_groups ( id, name )`;

/** Light projection for pickers, stats and seating. */
export const GUEST_SUMMARY_COLUMNS = 'id, full_name, group_id, side, plus_one_allowed';

export const GUEST_GROUP_COLUMNS = 'id, wedding_id, name, side, notes';

export const DESIGN_COLUMNS = 'id, wedding_id, name, design_data, storage_path, created_at';

export const INVITATION_COLUMNS =
  'id, wedding_id, group_id, guest_id, design_id, delivery_channel, status, sent_at, delivered_at, opened_at, created_at';

export const INVITATION_LIST_SELECT = `${INVITATION_COLUMNS},
  guest:guests ( id, full_name ),
  group:guest_groups ( id, name ),
  design:invitation_designs ( id, name ),
  events:invitation_events ( event_id )`;

export const EVENT_COLUMNS =
  'id, wedding_id, event_type, name, starts_at, ends_at, venue_name, address, city, notes, sort_order';

export const RSVP_COLUMNS = 'guest_id, event_id, response, responded_at, attendance_checked_in_at';

export const SEATING_TABLE_COLUMNS = 'id, event_id, name, capacity, sort_order';

export const SEATING_ASSIGNMENT_COLUMNS = 'event_id, guest_id, table_id, seat_number';
