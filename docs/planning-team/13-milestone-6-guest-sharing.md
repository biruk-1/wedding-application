# Planning Team — 13. Milestone 6: shared guest management

Status: **implemented locally.** Applied to the local Supabase stack. Nothing deployed.

## 1. Database

`supabase/migrations/20261106130000_team_guest_sharing.sql`

### RPCs

| RPC | Who | Notes |
| --- | --- | --- |
| `assign_group_coordinator` / `unassign_group_coordinator` | owner | Flags `can_delete` (default off), `can_send_invitations` (default on) |
| `delete_guest` / `delete_guest_group` | delete / `guests.manage_all` | Atomic invitation cleanup for guest-only or group-only invites |
| `get_wedding_guest` / `list_wedding_guests` | members with guest or coordinator access | Nulls contact columns without access (D7) |
| `guest_name_email_taken` | writers / coordinators | Duplicate check after contact SELECT revoke |
| `get_guest_stats` | same visibility as guest list | Totals only over visible guests (coordinators cannot infer other groups) |
| `ensure_family_guest_groups` | `guests.manage_all` | D10 one-tap Bride's / Groom's family; idempotent |

### Contact privacy (D7)

- Table-level SELECT on `guests` revoked for `authenticated`; non-contact columns re-granted.
- Contact columns (`phone`, `email`, `dietary_notes`, `notes`) are INSERT/UPDATE only for clients.
- `private.can_view_guest_contacts`: wedding-wide `guests.contacts.view` **or** coordinator of that exact group.
- Safe directory RPCs set `contacts_visible` and null contacts when denied.

### Other

- `invitation_designs` SELECT/CUD allowed for `guests.send_invitations` or coordinators with `can_send_invitations` (not only `guests.view`).

## 2. Application

- `guestService`: list/get/delete/stats/family via RPCs; create/update still table writes then reload via `get_wedding_guest`.
- `teamService.assignGroupCoordinator` / `unassignGroupCoordinator`.
- Guest detail: attribution names; contacts gated.
- Guest form: group picker limited to writable groups; contact fields hidden without access.
- Guest groups: “Create family groups” for `guests.manage_all`.
- Guests screen stats use `get_guest_stats` (scoped aggregates).

Coordinator management UI on member detail remains Milestone 8.

## 3. Tests

| Suite | Result |
| --- | --- |
| `planning_team_guests.sql` (family groups, coordinator isolation, D7 nulling, column revoke, delete/unassign) | PASS |
| Existing SQL suites | PASS (guest `RETURNING *` avoided contact columns) |

## 4. Still deferred

- Full coordinator management screens (Milestone 8).
- Task assignee collaboration — done in Milestone 7 (doc 14).
- Production apply — local only until explicitly approved.
