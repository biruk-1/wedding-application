export const EVENT_COLUMNS =
  'id, wedding_id, event_type, name, starts_at, ends_at, venue_name, address, city, notes, sort_order';

export const TIMELINE_ITEM_COLUMNS =
  'id, event_id, title, starts_at, ends_at, assigned_to, notes, sort_order';

export const TIMELINE_ITEM_LIST_SELECT = `${TIMELINE_ITEM_COLUMNS},
  assignee:profiles ( id, display_name )`;
