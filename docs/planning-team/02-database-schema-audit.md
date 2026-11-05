# Planning Team — 02. Database schema audit

## Sources and method

1. `reference/kiburan_schema.sql` (PM original, 383 lines, SHA-256 `B1D81E008878182E57580D96005D1C34FDA019ABF8F574BC85D772A049A2C594`, unchanged).
2. All 8 files in `supabase/migrations/`.
3. **The running local database** (`supabase_db_kiburan`, Postgres 15), queried read-only through `information_schema`, `pg_constraint`, `pg_indexes`, `pg_policies`, `pg_proc`, and privilege functions. The live catalog matches the migrations exactly: 37 public tables, RLS enabled on all 37, 107 public policies, 12 storage policies, 17 triggers on the audited tables.

Local data snapshot (for migration-safety reasoning, not production): 155 weddings, 155 `wedding_members` rows (all `owner`, exactly one per wedding, creator is always a member), 0 `wedding_invites`, 18 `guest_groups` (all with `side`). **Production was not inspected** (no linked project).

Notation: `PK` primary key, `FK` foreign key, `→` references, `NA` = no `ON DELETE` clause (NO ACTION). Policies use these helpers (all `SECURITY DEFINER`, `search_path = ''`):

| Helper | True when the caller (`auth.uid()`) … |
| --- | --- |
| `private.is_wedding_member(w)` | has any `wedding_members` row for `w` |
| `private.can_write_wedding(w)` | has role `owner`, `partner`, `planner` or `collaborator` |
| `private.is_wedding_owner(w)` | has role `owner` |
| `private.is_vendor_team_member(v)` | is in `vendor_team_members` for `v` or is `vendors.owner_user_id` |

Read access below always means "authenticated only"; `anon` has no policy on any audited table except lookup tables.

---

## Identity and membership

### `profiles`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | no | — (must equal `auth.users.id`) |
| display_name | text | no | `''` |
| phone | text | yes | |
| avatar_url | text | yes | |
| preferred_language | text | no | `'en'` |
| created_at, updated_at | timestamptz | no | `now()` |

- PK `id`; FK `id → auth.users(id) ON DELETE CASCADE`.
- Check `preferred_language in ('en','am')`. No unique on `phone`. No email column (email lives only in `auth.users`).
- Trigger `profiles_set_updated_at`. Rows created by `private.handle_new_user()` on `auth.users` insert.
- RLS: SELECT self, any co-member of any shared wedding, vendor-team peers; UPDATE self only. No INSERT/DELETE policy.
- **Note:** co-members can read each other's `phone`.

### `weddings`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` |
| created_by | uuid | no | — |
| title | text | no | |
| partner_one_name, partner_two_name | text | **yes** (made nullable by `20261103180000`) | |
| wedding_date | date | yes | |
| city | text | yes | |
| country_code | char(2) | no | `'ET'` |
| timezone | text | no | `'Africa/Addis_Ababa'` |
| style, cover_image_url | text | yes | |
| status | text | no | `'planning'` |
| currency_code | char(3) | no | `'ETB'` |
| estimated_guest_count | int | yes | |
| created_at, updated_at | timestamptz | no | `now()` |
| celebration_kind | text | no | `'wedding'` (added by migration) |

- PK `id`; FK `created_by → profiles` (NA).
- Checks: `status in (planning, completed, cancelled, archived)`, `estimated_guest_count >= 0`, `celebration_kind in (wedding, shemgelena, qelekel, baby_shower, birthday, anniversary, graduation, other)`.
- No secondary index on `created_by`.
- Trigger `weddings_set_updated_at`.
- RLS: SELECT members; UPDATE `can_write_wedding` (USING and WITH CHECK). No INSERT/DELETE policy (creation via `create_wedding` RPC; no deletion path at all).
- **Note:** the UPDATE policy is not column-restricted, so any writer can change `created_by`, `status`, `currency_code`, partner names, etc.

### `wedding_members`

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| wedding_id | uuid | no | |
| user_id | uuid | no | |
| role | text | no | — |
| joined_at | timestamptz | no | `now()` |

- PK `(wedding_id, user_id)` → membership is unique per user per wedding.
- FKs: `wedding_id → weddings ON DELETE CASCADE`, `user_id → profiles ON DELETE CASCADE`.
- Check `role in ('owner','partner','planner','collaborator','viewer')`. No limit on the number of owners and no minimum.
- Index `idx_wedding_members_user (user_id)`.
- No triggers. No `invited_by`, `updated_at`, or status columns.
- RLS: SELECT for any member of the same wedding. **No INSERT, UPDATE or DELETE policy** → all writes are denied to clients; only `SECURITY DEFINER` RPCs write.

### `wedding_invites` (Planning Team invitations — distinct from guest `invitations`)

| Column | Type | Null | Default |
| --- | --- | --- | --- |
| id | uuid | no | `gen_random_uuid()` |
| wedding_id | uuid | no | |
| invited_email, invited_phone | text | yes | |
| role | text | no | `'collaborator'` |
| token_hash | text | no | |
| invited_by | uuid | no | |
| expires_at | timestamptz | no | — |
| accepted_by | uuid | yes | |
| accepted_at, revoked_at | timestamptz | yes | |
| created_at | timestamptz | no | `now()` |

- PK `id`; unique `token_hash`.
- FKs: `wedding_id → weddings CASCADE`, `invited_by → profiles` (NA), `accepted_by → profiles` (NA).
- Checks: `role in ('partner','planner','collaborator','viewer')` (owner cannot be invited), `invited_email is not null or invited_phone is not null`.
- Index `idx_wedding_invites_wedding (wedding_id)` (added by migration).
- Not enforced: `accepted_by`/`accepted_at` set together, `expires_at > created_at`, one pending invite per recipient, email normalisation, `revoked_by`.
- RLS: SELECT and UPDATE for owners only. No INSERT (RPC only) or DELETE policy.
- Column privileges: the migration runs `revoke select/insert/update (token_hash)` from `anon, authenticated`, **but the live catalog shows both roles still have SELECT/INSERT/UPDATE on `token_hash`** because they hold table-level privileges (see doc 04).

---

## Events, tasks and comments

### `wedding_events`

Columns: `id uuid PK default gen_random_uuid()`, `wedding_id uuid not null`, `event_type text not null default 'other'` (no allow-list), `name text not null`, `starts_at`, `ends_at timestamptz`, `venue_name`, `address`, `city`, `notes text`, `sort_order int not null default 0`. No `created_at`/`updated_at`.

- FK `wedding_id → weddings CASCADE`. Check `ends_at >= starts_at` when both set.
- Index `idx_wedding_events_wedding (wedding_id, starts_at)`.
- RLS: SELECT members; INSERT/UPDATE/DELETE `can_write_wedding`.

### `wedding_tasks`

Columns: `id` PK, `wedding_id not null`, `event_id`, `category_id`, `template_id`, `parent_task_id` (all nullable uuids), `title not null`, `description`, `status not null default 'todo'`, `priority not null default 'medium'`, `due_date date`, `completed_at`, `created_by uuid` (nullable), `sort_order int default 0`, `created_at`, `updated_at`.

- FKs: `wedding_id → weddings CASCADE`; `event_id → wedding_events SET NULL`; `category_id → task_categories SET NULL`; `template_id → checklist_templates SET NULL`; `parent_task_id → wedding_tasks SET NULL`; `created_by → profiles` (NA).
- Checks: `status in (todo, in_progress, blocked, done, cancelled)`, `priority in (low, medium, high, urgent)`.
- Indexes: `idx_wedding_tasks_board (wedding_id, status, due_date)`, `idx_wedding_tasks_category (wedding_id, category_id)`.
- Triggers: `wedding_tasks_same_wedding_event`, `wedding_tasks_parent_same_wedding` (cross-wedding guards), `wedding_tasks_set_updated_at`, `wedding_tasks_sync_completed_at`.
- RLS: SELECT members; INSERT/UPDATE/DELETE `can_write_wedding`. No `updated_by`.

### `task_assignees`

Columns: `task_id uuid`, `user_id uuid`, `assigned_at timestamptz default now()`.

- PK `(task_id, user_id)`; FKs `task_id → wedding_tasks CASCADE`, `user_id → profiles CASCADE`.
- Index `idx_task_assignees_user (user_id)` (supports "my assigned tasks").
- No `assigned_by`.
- RLS: SELECT members of the task's wedding; INSERT requires writer **and** the assignee is a member of that wedding (good cross-tenant guard); DELETE writer. No UPDATE policy.
- **Note:** removing a member does not remove their assignments (no trigger; the FK only cascades on profile deletion).

### `task_comments`

Columns: `id` PK, `task_id not null`, `author_id not null`, `body text not null`, `created_at default now()`.

- FKs `task_id → wedding_tasks CASCADE`, `author_id → profiles` (NA). No index on `task_id`.
- RLS: SELECT members; INSERT requires `author_id = auth.uid()` and writer (viewers cannot comment); DELETE author or owner. No UPDATE.

### `timeline_items`

Columns: `id` PK, `event_id not null`, `title not null`, `starts_at`, `ends_at`, `assigned_to uuid`, `notes`, `sort_order int default 0`.

- FKs `event_id → wedding_events CASCADE`, `assigned_to → profiles` (NA). Check `ends_at >= starts_at`.
- Index `idx_timeline_items_event (event_id, starts_at)`.
- RLS: SELECT/INSERT/UPDATE/DELETE via the parent event's wedding (member / writer).
- **Not enforced:** `assigned_to` must be a member of the wedding (no trigger). Any profile id can be stored.

---

## Guests, groups, invitations and RSVPs

### `guest_groups`

Columns: `id` PK, `wedding_id not null`, `name text not null`, `side text`, `notes text`. No timestamps, no `created_by`.

- FK `wedding_id → weddings CASCADE`. Check `side in ('partner_one','partner_two','both','other')`. No unique on `(wedding_id, name)`.
- Index `idx_guest_groups_wedding (wedding_id)`.
- RLS: SELECT members; INSERT/UPDATE/DELETE writer.
- `side = partner_one / partner_two` is the existing hook for "bride's family / groom's family" groups.

### `guests`

Columns: `id` PK, `wedding_id not null`, `group_id`, `full_name not null`, `phone`, `email`, `side`, `guest_type`, `plus_one_allowed bool not null default false`, `dietary_notes`, `notes`, `created_at default now()`. **No `created_by`, `updated_by`, `updated_at`.**

- FKs `wedding_id → weddings CASCADE`, `group_id → guest_groups SET NULL`.
- Checks: `side in (partner_one, partner_two, both, other)`, `guest_type in (family, friend, coworker, other)`.
- Index `idx_guests_wedding (wedding_id, full_name)`. No index on `group_id` (needed for group-scoped RLS).
- Trigger `guests_group_same_wedding` (group must belong to the guest's wedding).
- RLS: SELECT members (including viewers, all columns including phone/email); INSERT/UPDATE/DELETE writer.

### `invitations` (guest invitations)

Columns: `id` PK, `wedding_id not null`, `group_id`, `guest_id`, `design_id`, `token_hash text not null unique`, `delivery_channel`, `status not null default 'draft'`, `sent_at`, `delivered_at`, `opened_at`, `created_at`.

- FKs `wedding_id → weddings CASCADE`; `group_id`, `guest_id`, `design_id` → `SET NULL`.
- Checks: `guest_id is not null or group_id is not null`; channel and status allow-lists.
- Index `idx_invitations_wedding_status (wedding_id, status)`.
- Trigger `invitations_same_wedding`.
- RLS: SELECT members; INSERT/UPDATE/DELETE writer. Created through `create_guest_invitation`; cancelled by a direct `update status='cancelled'` from `invitationService.ts`.
- `token_hash` is readable by every member (column revoke ineffective, see doc 04).

### `invitation_events`

PK `(invitation_id, event_id)`, both `CASCADE`. Trigger `invitation_events_same_wedding`. RLS via the parent invitation (member read / writer write; no UPDATE).

### `guest_rsvps`

Columns: `guest_id`, `event_id`, `response not null default 'pending'`, `responded_at`, `attendance_checked_in_at`.

- PK `(guest_id, event_id)`; FKs both `CASCADE`. Check `response in (pending, yes, no, maybe)`.
- Index `idx_guest_rsvps_event (event_id, response)`.
- Trigger `guest_rsvps_same_wedding`.
- RLS via parent guest: member read, writer write. Anonymous guests answer only through `submit_guest_invitation_rsvp`.

### Related: `seating_tables`, `seating_assignments`, `invitation_designs`

- `seating_tables`: unique `(event_id, name)`, check `capacity > 0`, RLS via event.
- `seating_assignments`: PK `(event_id, guest_id)`, unique `(table_id, seat_number)`, trigger `seating_assignments_integrity`, RLS via event.
- `invitation_designs`: RLS member read / writer write.

---

## Vendors (wedding side)

### `wedding_vendors`

Columns: `id` PK, `wedding_id not null`, `event_id`, `vendor_id`, `category_id`, `external_business_name`, `external_phone`, `notes`, `status not null default 'shortlisted'`, `created_at`.

- FKs `wedding_id CASCADE`; `event_id`, `vendor_id`, `category_id` → `SET NULL`.
- Checks: `vendor_id is not null or external_business_name is not null`; status allow-list.
- Index `idx_wedding_vendors_wedding (wedding_id, status)`. Trigger `wedding_vendors_same_wedding_event`.
- RLS: SELECT members **or vendor team**; INSERT writer; UPDATE writer **or vendor team** (both USING and WITH CHECK); DELETE writer.

### `vendor_inquiries`

Columns: `id` PK, `wedding_id not null`, `vendor_id not null`, `service_id`, `requested_event_id`, `message`, `proposed_budget numeric(14,2)`, `status not null default 'new'`, `created_by not null`, `created_at`.

- FKs `wedding_id CASCADE`, `vendor_id` (NA), `service_id` (NA), `requested_event_id SET NULL`, `created_by` (NA).
- Checks `proposed_budget >= 0`, status allow-list.
- Indexes `(vendor_id, status)`, `(wedding_id)`. Triggers: same-wedding event, service-belongs-to-vendor.
- RLS: SELECT members or vendor team; INSERT writer with `created_by = auth.uid()`; UPDATE writer **or vendor team**. No DELETE.
- **Note:** `proposed_budget` is financial information visible to every member.

### `vendor_bookings`

Columns: `id` PK, `wedding_vendor_id not null`, `quote_id`, `booking_date`, `start_at`, `end_at`, `total_amount`, `deposit_amount`, `currency_code default 'ETB'`, `status default 'pending'`, `contract_storage_path`, `notes`, `created_at`.

- FKs `wedding_vendor_id CASCADE`, `quote_id` (NA). Checks: amounts `>= 0`, `deposit <= total`, `end_at >= start_at`, status allow-list. No index on `wedding_vendor_id`.
- RLS via `wedding_vendors`: SELECT member or vendor team; INSERT writer; UPDATE writer or vendor team. No DELETE.
- **Note:** `total_amount`/`deposit_amount` are financial data visible to every member.

---

## Budget

### `budget_categories` (lookup)

`id` PK, `slug` unique, `name_en`, `name_am`. RLS: SELECT `anon, authenticated` (true). No client writes.

### `wedding_budgets`

`wedding_id` PK (→ `weddings CASCADE`), `total_budget numeric(14,2) not null default 0 check >= 0`, `currency_code default 'ETB'`, `updated_at`. Trigger `wedding_budgets_set_updated_at`. Row inserted by `create_wedding`.
RLS: SELECT members (viewers included); UPDATE writer. No INSERT/DELETE.

### `budget_items`

`id` PK, `wedding_id not null`, `category_id`, `wedding_vendor_id`, `booking_id`, `label not null`, `estimated_amount not null default 0`, `committed_amount`, `notes`, `created_at`. **No `created_by`, no kind/discriminator column.**

- FKs `wedding_id CASCADE`; `category_id`, `wedding_vendor_id`, `booking_id` → `SET NULL`. Checks amounts `>= 0`.
- Index `idx_budget_items_wedding (wedding_id)`. Trigger `budget_items_same_wedding`.
- RLS: SELECT members; INSERT/UPDATE/DELETE writer.
- **Important:** onboarding "allocations" and later "expenses" are both rows in this table (`docs/budget.md`: "There is no separate category-allocation table"). A permission split between *managing allocations* and *creating expenses* cannot be enforced without a discriminator (see doc 06).

### `expense_payments`

`id` PK, `budget_item_id not null`, `amount numeric(14,2) not null check > 0`, `paid_at default now()`, `payment_method` (allow-list incl. `telebirr`, `chapa`), `reference`, `receipt_storage_path`, `notes`, `recorded_by uuid`.

- FKs `budget_item_id CASCADE`, `recorded_by → profiles` (NA). Index `idx_expense_payments_item`.
- RLS via `budget_items`: SELECT member; INSERT/UPDATE/DELETE writer. `recorded_by` is not forced to `auth.uid()`.

---

## Files

### `wedding_files`

`id` PK, `wedding_id not null`, `uploaded_by not null`, `task_id`, `booking_id`, `display_name`, `storage_path`, `created_at`. Trigger `wedding_files_refs`. RLS: SELECT member; INSERT writer with `uploaded_by = auth.uid()`; UPDATE/DELETE writer.
Storage bucket `wedding-documents` (private) is gated by the first path segment (`{wedding_id}/…`) with `is_wedding_member` / `can_write_wedding`. Receipts and contracts stored here are readable by every member.

---

## Database functions (live catalog)

| Function | Definer | `search_path` | EXECUTE (anon / authenticated) |
| --- | --- | --- | --- |
| `public.create_wedding(…13 args)` | yes | `''` | yes / yes |
| `public.create_wedding_invite` | yes | `public, extensions, private` | yes / yes |
| `public.accept_wedding_invite` | yes | `public, extensions, private` | yes / yes |
| `public.set_wedding_member_role` | yes | `public, extensions, private` | yes / yes |
| `public.create_guest_invitation` | yes | `public, extensions, private` | yes / yes |
| `public.mark_guest_invitation_sent` | yes | `public, private` | yes / yes |
| `public.get_guest_invitation_by_token` | yes | `public, extensions` | yes / yes (intended) |
| `public.submit_guest_invitation_rsvp` | yes | `public, extensions` | yes / yes (intended) |
| `private.is_wedding_member`, `can_write_wedding`, `is_wedding_owner`, `wedding_member_role`, vendor helpers | yes | `''` | yes / yes |
| `private.handle_new_user` | yes | `''` | no / no |
| `private.assert_*`, `set_updated_at`, `sync_task_completed_at`, `protect_vendor_verification` | no (invoker) | `''` | yes / yes |

Every authenticated-only RPC also grants EXECUTE to `anon`. The migrations ran `revoke all … from public`, but Supabase's default privileges grant EXECUTE to `anon` explicitly, so that revoke has no effect. All of these RPCs reject a null `auth.uid()`, so this is defence-in-depth, not an exploitable hole today.

Schema `CREATE` privilege: `anon` and `authenticated` have **no** CREATE on `public`, `private` or `extensions` (verified), so the non-empty `search_path` values are low risk.

## Other platform facts

- Realtime: no tables are in any publication (`pg_publication_tables` is empty). Collaboration today is refresh-based (TanStack `staleTimes.collaborative = 30s`).
- Storage buckets: `avatars` (public), `wedding-covers` (public), `wedding-documents` (private).

## Tables named in the brief

All requested tables exist: `profiles`, `weddings`, `wedding_members`, `wedding_invites`, `wedding_events`, `wedding_tasks`, `task_assignees`, `task_comments`, `guest_groups`, `guests`, `guest_rsvps`, `invitations`, `wedding_vendors`, `vendor_inquiries`, `vendor_bookings`, `budget_categories`, `wedding_budgets`, `budget_items`, `expense_payments`, `timeline_items`. There is **no** permissions table, group-coordinator table, or activity-log table.
