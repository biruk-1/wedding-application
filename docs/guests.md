# Guests, invitations, RSVPs and seating

Feature module: `src/features/guests/`. Routes are thin re-exports under
`app/(app)/weddings/[weddingId]/guests/` plus the public `app/invite/[token].tsx`.

## Screens and routes

| Route | Screen | Purpose |
| --- | --- | --- |
| `/(app)/weddings/:id/guests` | `GuestsScreen` | Stats, search, group + RSVP filters, paged list |
| `.../guests/new`, `.../guests/:guestId/edit` | `GuestFormScreen` | Create / edit a guest |
| `.../guests/:guestId` | `GuestDetailScreen` | Details, planner RSVP per event, invitations, delete |
| `.../guests/groups` | `GuestGroupsScreen` | Create / edit / delete groups |
| `.../guests/designs` | `InvitationDesignsScreen` | Create designs with a live preview |
| `.../guests/invite` | `CreateInvitationScreen` | Pick guest or group, design, events, preview, create, share |
| `.../guests/tracking` | `InvitationTrackingScreen` | Status counts and list |
| `.../guests/seating` | `SeatingScreen` | Per-event tables and assignments |
| `/invite/:token` | `PublicInviteScreen` | Public token-authorised preview + RSVP (works signed out) |

Writers (`useWeddingRole().canWrite`) see the create/edit controls; viewers can browse. RLS
(`can_write_wedding`) is what actually enforces this.

## Schema used (no invented columns)

`guest_groups`, `guests`, `invitation_designs`, `invitations`, `invitation_events`, `guest_rsvps`,
`seating_tables`, `seating_assignments`, `wedding_events`.

- `guests` has **no accompanying-guest count**. Only `plus_one_allowed` (boolean) exists, so the UI
  shows "plus one allowed" and counts guests that have it; it never records how many people come.
- `invitation_events` is a junction (which events an invitation covers), **not** an audit log.
  Open/sent timestamps live on `invitations` (`sent_at`, `delivered_at`, `opened_at`).
- `guests.group_id`, `invitations.guest_id/group_id/design_id` are `ON DELETE SET NULL`, but
  `invitations` has `CHECK (guest_id IS NOT NULL OR group_id IS NOT NULL)`. The services therefore
  delete the invitations that would violate the check before deleting a guest or group:
  - `deleteGuest`: removes invitations with `guest_id = X AND group_id IS NULL`.
  - `deleteGuestGroup`: removes invitations with `group_id = X AND guest_id IS NULL`.
  Invitations that name both a guest and a group survive and lose only the deleted reference.
  Removed invitations' links stop working.
- Duplicate guests: before insert/update the service checks for the same wedding + full name +
  email (case-insensitive, only when an email is provided) and returns a friendly
  `duplicate_guest` error. There is no database unique constraint, so this is a soft check.
- Seating capacity is validated client-side in `assignGuest` (the schema only has
  `UNIQUE(table_id, seat_number)` and `capacity > 0`). A guest already at the table does not count
  against it; moving a guest upserts the single `(event_id, guest_id)` row. Seat numbers are unused.

## `design_data` convention

Stored only in `invitation_designs.design_data` (jsonb), documented in `types.ts`:

```ts
{
  title?: string;
  message?: string;
  accent?: string; // hex, #RGB or #RRGGBB
  layout?: 'classic' | 'floral' | 'modern';
}
```

`parseDesignData` validates untrusted jsonb (unknown keys, bad colours and unknown layouts are
dropped) and `InvitationPreviewCard` falls back to the classic layout and default accent. No designs
are seeded: the designs screen has a create flow with layout presets and an empty state.
`invitation_designs.storage_path` is **unused** (there is no storage bucket yet).

## Sharing is not delivery

- The app creates an invitation through `create_guest_invitation`, builds the link with
  `Linking.createURL('/invite/<rawToken>')`, and hands only that link to React Native `Share.share`.
- After the share sheet reports a completed share, `mark_guest_invitation_sent` records
  `status = 'sent'` / `sent_at`. This means "the planner shared the link", **not** that anything
  was delivered. The app never sets `delivered` and never claims SMS/email delivery.
- The raw token is returned once, held in component state only, and the mutation is `reset()`
  immediately. It is never logged, stored, cached, or queried back; `token_hash` is never selected
  (explicit column lists in `guestSelects.ts`, and `invitationService` strips any hash an RPC row
  carries). To resend, create a new invitation.
- `Linking.createURL` yields `kiburan://invite/<token>` in a build (scheme in `app.json`) and an
  `exp://.../--/invite/<token>` URL in Expo Go. There is no universal-link / web domain configured.

## Migration RPCs (`supabase/migrations/20260330120000_guest_invitation_rpcs.sql`)

| RPC | Granted to | Used by |
| --- | --- | --- |
| `create_guest_invitation(p_wedding_id, p_guest_id, p_group_id, p_design_id, p_event_ids, p_delivery_channel)` | authenticated (writers) | `createInvitation` |
| `mark_guest_invitation_sent(p_invitation_id)` | authenticated (writers) | `markInvitationSent` |
| `get_guest_invitation_by_token(p_raw_token)` | anon, authenticated | `getInvitationPreviewByToken` |
| `submit_guest_invitation_rsvp(p_raw_token, p_guest_id, p_event_id, p_response)` | anon, authenticated | `submitRsvpByToken` |

Notes:

- `get_guest_invitation_by_token` records the first open (`opened_at`, status `opened`) as a side
  effect, so a planner opening their own link also marks it opened.
- Without `invitation_events` rows the RPCs fall back to all wedding events.
- `mark_guest_invitation_sent` returns a safe jsonb payload (no `token_hash`).
- Planner RSVP edits are a normal authenticated upsert on `guest_rsvps` (RLS: writers).

## Public invitation route and auth gate

`resolveAuthRedirect` treats root segment `invite` (like `reset-password`) as reachable with or
without a session and never redirects away from it. `PublicInviteScreen` uses no user id; its query
key is `['invite', token]` (not under `['u', userId]`), holds only what the token grants, uses a 5
minute `gcTime`, and is cleared with the rest of the cache when the signed-in account changes.
Invalid and cancelled tokens render dedicated states.

## Query keys and caching

All wedding-scoped keys start with `['u', userId, 'wedding', weddingId, ...]`
(`guestGroups`, `guestsRoot/guests/guestSummaries/guest`, `invitationDesigns`, `invitations`,
`weddingEvents`, `guestRsvps`, `seating*`). Guests use `staleTimes.collaborative`. Mutations
invalidate the affected keys; deleting a group or guest also invalidates invitations (and RSVPs /
seating for guests). Skeletons (`GuestsSkeleton`, `InvitationTrackingSkeleton`) show only when no
cached data exists.

Guest list: server-side search (`ilike` over name/email/phone, input sanitised) and group filter,
`range` pagination of 40 rows (one extra row is requested to compute `hasMore`). The RSVP status
filter is client-side over loaded rows because RSVP state lives in another table. Stats come from a
light `listGuestSummaries` projection (all guests, paged through PostgREST's row cap) and
`listRsvpsForWedding` (inner join through `guests.wedding_id`).

`computeGuestStats` counts one event's response (no row = pending) or, with no event chosen, each
guest once using their strongest response across events (yes > maybe > no > pending).

## Not built / limitations

- **No SMS or email provider.** Nothing is sent by the app; `delivered_at` is never written.
- No guest import, QR check-in UI (`attendance_checked_in_at` is read-only/unused), seat numbers,
  or per-person plus-one counts.
- No storage bucket: `invitation_designs.storage_path` is unused.
- PostgREST `max_rows` (default 1000) applies to RSVPs and invitations lists; guest summaries page
  through it.

## Tests

- `utils/guestHelpers.test.ts`, `validation/guestSchemas.test.ts`: pure unit tests.
- `services/guestService.integration.test.ts`: runs the real services (with `@/lib/supabase`
  swapped for a Node client) against local Supabase: groups, guests, search, paging, two-user
  isolation, RPC invitation creation, anonymous preview, RSVP submit/upsert, seating capacity,
  delete cleanup. Skips when local Supabase is unreachable. Run `npm run db:reset` first so the
  guest invitation migration is applied.
- `auth/navigation/resolveAuthRedirect.test.ts` covers the `invite` segment.
