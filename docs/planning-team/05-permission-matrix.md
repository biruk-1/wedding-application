# Planning Team — 05. Permission matrix (proposal)

Status: **proposal for review.** Nothing here is implemented. Items marked *(proposed addition)* go beyond the brief's minimum list and need approval.

## 1. Five layers of access

| Layer | What it is | Where it lives | Who changes it |
| --- | --- | --- | --- |
| 1. Ownership authority | Being one of the (up to two) owners. Implies every permission, including reserved ones. Never stored as permission rows. | `wedding_members.role = 'owner'` | Only the ownership RPCs (co-owner invite acceptance; two-party ownership change) |
| 2. Role template | A named starting set of permissions (Co-host, Family coordinator, …). A label plus a default, **not** an authority source. | `wedding_members.role` value + seeded template table | Owners |
| 3. Individual permissions | The member's actual, effective permission set. Starts from the template, then owners add/remove. | `wedding_member_permissions` rows | Owners only |
| 4. Group-level access | Coordinator assignment to specific guest groups, giving guest rights **only inside those groups**. | `guest_group_coordinators` rows | Owners only |
| 5. Record-level rules | Built-in rules tied to a record, e.g. an assignee may update the status of a task assigned to them; a comment author may delete their own comment. | Hard-coded in RLS / RPCs | Not configurable |

Rules that apply everywhere:

- A relationship to the bride or groom (family, friend) grants nothing by itself. Only layers 1–5 grant access.
- Effective access = owner? everything : (permission rows ∪ group grants ∪ record rules).
- Reserved permissions can never be granted to a non-owner, even by an owner.
- Permissions have dependencies (e.g. `budget.expenses.create` needs `budget.expenses.view`, which needs `budget.view`). The grant RPC adds missing prerequisites and the revoke RPC removes dependents, so stored sets are always consistent.
- Default for any new collaborator is **no financial access** and **no guest access**, regardless of template, unless the template or the owner explicitly adds it.

## 2. Permission catalog

### Team and wedding settings

| Key | Meaning | Grantable to non-owners |
| --- | --- | --- |
| `team.view` | See the member list (names, avatars, role labels) | Yes |
| `team.invite` | Create / revoke / resend Planning Team invitations | **No — owner-reserved** |
| `team.members.manage` | Change a member's role template, remove members | **No — owner-reserved** |
| `team.permissions.manage` | Edit individual permissions and coordinator assignments | **No — owner-reserved** |
| `wedding.settings.manage` *(proposed addition)* | Edit title, date, partner names, status, currency, style, cover | **No — owner-reserved** (brief: owners manage settings) |
| `activity.view` *(proposed addition)* | Read the activity history for areas they can already see | Yes |

### Guests

| Key | Meaning |
| --- | --- |
| `guests.view` | See every guest and group in the wedding (names, group, side, RSVP) |
| `guests.contacts.view` *(proposed addition)* | See guest `phone`, `email`, `dietary_notes`, `notes`. Without it, a guest-viewer sees names and RSVP only. |
| `guests.create` | Add guests to any group (or no group) |
| `guests.update` | Edit any guest; update RSVPs |
| `guests.delete` | Delete any guest |
| `guests.manage_all` | Everything above **plus** create/rename/delete groups and manage seating. This is the "wedding-wide guest manager" grant from the brief. |
| `guests.send_invitations` | Create, mark sent, cancel guest invitations; manage invitation designs |

### Tasks

| Key | Meaning |
| --- | --- |
| `tasks.view` | See all tasks, assignees and comments |
| `tasks.create` | Create tasks (including initializing from templates) |
| `tasks.update` | Edit any task (title, dates, status, priority, category) |
| `tasks.assign` | Add/remove assignees (assignees must be members) |
| `tasks.comment` | Comment on tasks they can see |
| `tasks.delete` *(proposed addition)* | Delete tasks. Kept separate because it is destructive. |

### Vendors

| Key | Meaning |
| --- | --- |
| `vendors.view` | See the wedding's saved/booked vendors and their status (not money) |
| `vendors.manage` | Shortlist, update status/notes, remove wedding vendors, create/update bookings (amounts additionally require budget permissions) |
| `vendors.inquiries.manage` | Send and follow up vendor inquiries |

### Budget

| Key | Meaning |
| --- | --- |
| `budget.view` | See the total budget and category totals (aggregates only) |
| `budget.expenses.view` | See individual expense lines, vendor booking amounts, inquiry `proposed_budget` |
| `budget.payments.view` *(brief: "viewing payment records")* | See individual payments, payment methods, references, receipts |
| `budget.expenses.create` | Add expense lines |
| `budget.expenses.update` | Edit expense lines and record/delete payments against them |
| `budget.expenses.delete` | Delete expense lines (and their payments) |
| `budget.manage` | Change the total budget and category allocations |

### Timeline and documents

| Key | Meaning |
| --- | --- |
| `timeline.view` | See events, run-of-show items, calendar |
| `timeline.manage` | Create/edit/delete events and timeline items |
| `documents.view` *(proposed addition)* | See non-financial wedding documents |
| `documents.manage` *(proposed addition)* | Upload, rename, delete documents |

### Dependencies (enforced by the grant RPC)

```
guests.contacts.view, guests.create, guests.update, guests.delete, guests.send_invitations → guests.view
guests.manage_all → guests.view, guests.contacts.view, guests.create, guests.update, guests.delete
tasks.create, tasks.update, tasks.assign, tasks.comment, tasks.delete → tasks.view
vendors.manage, vendors.inquiries.manage → vendors.view
budget.expenses.view → budget.view
budget.payments.view → budget.expenses.view
budget.expenses.create, budget.expenses.update, budget.expenses.delete → budget.expenses.view
budget.manage → budget.view
timeline.manage → timeline.view
documents.manage → documents.view
```

## 3. Default role templates

Legend: ✓ granted by default · — not granted · **G** granted only inside assigned guest groups · **A** only for tasks assigned to them (record rule) · **R** owner-reserved (implicit for owners, never grantable).

| Permission | Owner | Co-host | Wedding planner | Family coordinator | Task manager | Viewer | Custom |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `team.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `team.invite` | R | — | — | — | — | — | — |
| `team.members.manage` | R | — | — | — | — | — | — |
| `team.permissions.manage` | R | — | — | — | — | — | — |
| `wedding.settings.manage` | R | — | — | — | — | — | — |
| `activity.view` | ✓ | ✓ | ✓ | — | — | — | — |
| `guests.view` | ✓ | ✓ | ✓ | G | — | — | — |
| `guests.contacts.view` | ✓ | ✓ | ✓ | G | — | — | — |
| `guests.create` | ✓ | ✓ | ✓ | G | — | — | — |
| `guests.update` | ✓ | ✓ | ✓ | G | — | — | — |
| `guests.delete` | ✓ | — | ✓ | — | — | — | — |
| `guests.manage_all` | ✓ | — | ✓ | — | — | — | — |
| `guests.send_invitations` | ✓ | ✓ | ✓ | G | — | — | — |
| `tasks.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `tasks.create` | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `tasks.update` | ✓ | ✓ | ✓ | A | ✓ | — | — |
| `tasks.assign` | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `tasks.comment` | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| `tasks.delete` | ✓ | — | ✓ | — | ✓ | — | — |
| `vendors.view` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `vendors.manage` | ✓ | ✓ | ✓ | — | — | — | — |
| `vendors.inquiries.manage` | ✓ | — | ✓ | — | — | — | — |
| `budget.view` | ✓ | — | — | — | — | — | — |
| `budget.expenses.view` | ✓ | — | — | — | — | — | — |
| `budget.payments.view` | ✓ | — | — | — | — | — | — |
| `budget.expenses.create` | ✓ | — | — | — | — | — | — |
| `budget.expenses.update` | ✓ | — | — | — | — | — | — |
| `budget.expenses.delete` | ✓ | — | — | — | — | — | — |
| `budget.manage` | ✓ | — | — | — | — | — | — |
| `timeline.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| `timeline.manage` | ✓ | ✓ | ✓ | — | — | — | — |
| `documents.view` | ✓ | ✓ | ✓ | — | ✓ | — | — |
| `documents.manage` | ✓ | ✓ | ✓ | — | — | — | — |

Notes:

- **Both owners** have identical, complete access. There is no "primary" owner.
- **Wedding planner** gets no budget access by default even though planners often handle money. The owner can add `budget.*` permissions per planner. This follows "collaborators receive no financial access unless explicitly authorized".
- **Family coordinator** guest rights apply only to guests in the groups the owner assigns (e.g. "Bride's family", which is a `guest_groups` row with `side = 'partner_one'`). Without an assignment they see no guests at all.
- **Viewer** sees tasks, timeline and vendor names only. No guest list (contact privacy) and no money.
- **Custom** starts with `team.view` only; the owner picks everything else.
- The existing role `collaborator` is kept as a legacy template (see doc 06 for backfill choices). `partner` is kept valid but no longer offered for new invites.

## 4. Group-level permissions

A `guest_group_coordinators` row `(wedding, group, member)` grants, **only for guests whose `group_id` is that group**:

| Capability | Default | Owner-configurable flag |
| --- | --- | --- |
| See the group and its guests, incl. contacts and RSVPs | on | — |
| Add guests (new guest must be placed in one of their groups) | on | — |
| Edit guests and their RSVPs (cannot move a guest to a group they do not coordinate) | on | — |
| Send / cancel guest invitations for guests in the group | on | `can_send_invitations` |
| Delete guests in the group | off | `can_delete` |
| Rename/delete the group, manage seating, see other groups | never (needs `guests.manage_all`) | — |

Rules:

- A coordinator never sees guests in other groups or ungrouped guests, and cannot read other groups' names.
- Several coordinators can share one group; one person can coordinate several groups.
- Wedding-wide guest permissions (`guests.view`, etc.) are a superset; a member with both simply has wedding-wide access.
- Owners always see the complete list and all changes (activity log records the actor for each guest change).

## 5. Record-level rules (fixed)

| Rule | Applies to |
| --- | --- |
| A member can always read their own membership row and their own effective permissions | `wedding_members`, `wedding_member_permissions` |
| An assignee with `tasks.view` may change the **status** of a task assigned to them and comment on it | `wedding_tasks`, `task_comments` |
| A comment author may delete their own comment; owners may delete any comment | `task_comments` |
| A member may leave a wedding; an owner may leave only if another owner remains | `leave_wedding` RPC |
| Guest invitation creation for a group requires coordination of that group (or wedding-wide `guests.send_invitations`) | `create_guest_invitation` |

## 6. How it will be enforced in Supabase

Enforcement is server-side only; the app reads the same rules for display.

1. **One permission helper**, modelled on the existing `private.*` helpers (`SECURITY DEFINER`, `STABLE`, `search_path = ''`, uses `auth.uid()` internally, never takes a user id from the client):
   - `private.has_wedding_permission(wedding_id, permission) → boolean`: true if the caller is an owner of the wedding, or has a matching `wedding_member_permissions` row.
   - `private.can_access_guest_group(wedding_id, group_id, capability) → boolean`: wedding-wide permission, or a coordinator row for that group (with the flag for delete/send).
   - `private.is_wedding_owner(wedding_id)` (existing) for reserved actions.
2. **RLS policies rewritten per table and per command** to call these helpers instead of `can_write_wedding`. Mapping:

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `weddings` | member | RPC only | `wedding.settings.manage` (owner) via RPC; direct UPDATE removed | — |
| `wedding_members` | `team.view` (own row always) | RPC only | RPC only | RPC only |
| `wedding_invites` | owner | RPC only | RPC only | — |
| `wedding_member_permissions` | own rows; owner all | RPC only | RPC only | RPC only |
| `guest_group_coordinators` | own rows; owner all; `guests.manage_all` read | RPC only | RPC only | RPC only |
| `wedding_events`, `timeline_items` | `timeline.view` | `timeline.manage` | `timeline.manage` | `timeline.manage` |
| `wedding_tasks` | `tasks.view` | `tasks.create` | `tasks.update` or assignee status rule (trigger limits columns) | `tasks.delete` |
| `task_assignees` | `tasks.view` | `tasks.assign` + assignee is member | — | `tasks.assign` |
| `task_comments` | `tasks.view` | `tasks.comment` or assignee | — | author or owner |
| `guest_groups` | `guests.view` or coordinator of that group | `guests.manage_all` | `guests.manage_all` | `guests.manage_all` |
| `guests` | `guests.view` or group access | `guests.create` or group access to new `group_id` | `guests.update` or group access to old **and** new `group_id` | `guests.delete` or group `can_delete` |
| `guest_rsvps` | via guest | via guest update rule | via guest update rule | via guest update rule |
| `invitations`, `invitation_events`, `invitation_designs` | `guests.view` / group | RPC / `guests.send_invitations` / group flag | same | same |
| `seating_tables`, `seating_assignments` | `guests.view` | `guests.manage_all` | `guests.manage_all` | `guests.manage_all` |
| `wedding_vendors` | `vendors.view` (vendor team rule unchanged) | `vendors.manage` | `vendors.manage` | `vendors.manage` |
| `vendor_inquiries` | `vendors.inquiries.manage` or `budget.expenses.view` | `vendors.inquiries.manage` | `vendors.inquiries.manage` | — |
| `vendor_bookings` | `budget.expenses.view` | `vendors.manage` + `budget.expenses.create` | `vendors.manage` + `budget.expenses.update` | — |
| `wedding_budgets` | `budget.view` | RPC | `budget.manage` | — |
| `budget_items` | `budget.expenses.view` (allocations: `budget.view`) | `budget.expenses.create` (allocations: `budget.manage`) | `budget.expenses.update` (allocations: `budget.manage`) | `budget.expenses.delete` (allocations: `budget.manage`) |
| `expense_payments` | `budget.payments.view` | `budget.expenses.update` | `budget.expenses.update` | `budget.expenses.update` |
| `wedding_files` + `wedding-documents` storage | `documents.view` (financial files: `budget.payments.view`) | `documents.manage` | `documents.manage` | `documents.manage` |
| `wedding_activity_log` | owner all; others filtered by `activity.view` + per-entry required permission | trigger/RPC only | — | — |

3. **Aggregates for `budget.view` without line access**: a `SECURITY DEFINER` RPC `get_budget_summary(wedding_id)` returns totals per category, checked with `budget.view`, so the dashboard can show totals to someone who cannot read individual expenses.
4. **Contact privacy without row hiding** (`guests.contacts.view`): guest rows stay readable for `guests.view`; contact columns are served by a `SECURITY DEFINER` RPC or a view that nulls them when the caller lacks the permission, with direct SELECT on those columns revoked. (Decision D7 in doc 08.)
5. **All team operations are RPCs** that check `is_wedding_owner` inside, lock the affected rows, validate the permission keys against the catalog (rejecting reserved keys), write the activity log, and return the new state.
6. **Client access hook**: one RPC `get_my_wedding_access(wedding_id)` returns `{ is_owner, role, permissions[], coordinated_group_ids[] }`. The app uses it only to show/hide UI. It replaces `useWeddingRole().canWrite`, the direct query in `TaskDetailScreen`, and `vendorService.canWriteWedding`.
7. **Tests**: each cell of the matrix becomes an assertion in a new SQL security suite run per template, using real local test accounts (Milestone 9).
