# Wedding timeline & calendar (Task 10)

Scoped to `/(app)/weddings/[weddingId]/timeline`.

## Features

- Event list with upcoming / past / all filters and “next up” card
- Calendar month view (no extra dependency) with date selection
- Event create / edit / delete (name, type, start/end, venue, address, city, notes)
- Wedding-day schedule via `timeline_items` for a selected event (add / edit / delete / reorder)
- Overlap warnings for timed schedule items
- Related checklist tasks (`wedding_tasks.event_id`) and confirmed vendor bookings (via `wedding_vendors.event_id`)

## Timezone

Times are stored as `timestamptz`. Display and form entry use `weddings.timezone` (default `Africa/Addis_Ababa`). Helpers live in `src/features/timeline/utils/datetime.ts`.

## Database

| Table | Usage |
| --- | --- |
| `wedding_events` | Planning events; RLS member read / writer CRUD |
| `timeline_items` | Day-of schedule rows tied to an **event** (not the wedding root) |
| `wedding_tasks` | Optional related tasks when `event_id` is set |
| `wedding_vendors` + `vendor_bookings` | Related confirmed/fulfilled bookings for vendors linked to the event |

`event_type` is unconstrained text. UI suggests: ceremony, reception, engagement, rehearsal, photography, venue_visit, other.

## Missing schema capabilities

- No location fields on `timeline_items` (only on `wedding_events`)
- No recurrence / reminders tables
- `vendor_bookings` has no direct `event_id` (linked through `wedding_vendors.event_id`)
- No migration required for this feature
