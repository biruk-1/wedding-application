# Planning Team — 04. RLS and security audit

Evidence comes from the live local catalog (`pg_policies`, `has_column_privilege`, `has_function_privilege`, `has_schema_privilege`, `information_schema.role_table_grants`) plus the migration source. Read-only queries only; nothing was changed.

## 1. Bottom line

- **Tenant isolation is in place.** RLS is enabled on all 37 public tables. Every wedding-scoped table is gated by membership of *that* wedding, and cross-wedding references are blocked by triggers. A nonmember, or a member of another wedding, cannot read or write a wedding's data.
- **The role model is far too coarse for the Planning Team.** Inside a wedding there are only three effective levels: member (read everything), writer (write everything, including all money), owner (plus invites and roles). There are no per-feature permissions, no financial privacy, no group scoping, no member removal, and two owners are not protected from each other.
- **Blocking gap:** collaborators must not be invited on any shared/production environment until Milestone 2 (database foundation) and Milestone 5 (permission enforcement) are in place. Today an invited `collaborator`/`planner`/`partner` gets full read/write over budget, payments, guests' contact details, vendors and documents, and a `viewer` can read all of it.

## 2. Required checks

| Does the current system prevent… | Result | Evidence |
| --- | --- | --- |
| Nonmembers accessing a wedding | **Yes** | All wedding policies use `is_wedding_member` / `can_write_wedding`; `security_foundation.sql` verifies an outsider cannot read another wedding. |
| Members accessing another wedding's data | **Yes** (row access) | Policies are per `wedding_id`; cross-wedding triggers on tasks, events, guests, invitations, RSVPs, seating, budget items, files. Exceptions in finding F8 (vendor-side updates) and F10 (`timeline_items.assigned_to`). |
| Viewers editing records | **Yes** | `can_write_wedding` excludes `viewer`; tested for tasks. Viewers also cannot comment (side effect). |
| Collaborators accessing restricted financial data | **No** | `wedding_budgets`, `budget_items`, `expense_payments` SELECT = any member; writes = any writer. `vendor_bookings` amounts and `vendor_inquiries.proposed_budget` are visible to every member. Receipts/contracts in the `wedding-documents` bucket are readable by every member. |
| Collaborators inviting other collaborators | **Yes** | `create_wedding_invite` requires `is_wedding_owner`; `wedding_invites` has no INSERT policy. |
| Unauthorized users modifying member roles | **Partly** | Non-owners blocked (tested). **Any owner can demote the other owner or promote anyone to owner** (`set_wedding_member_role`). |
| Users changing another person's permissions | **N/A → Partly** | No permission system exists. Role is the only lever; see previous row. |
| Unauthorized access to guest contact details | **No** | `guests` SELECT = any member, all columns (`phone`, `email`, `dietary_notes`, `notes`). `profiles.phone` is readable by every co-member. |
| Invitation token abuse | **Partly** | Tokens are 256-bit random and stored hashed (good). But: links are not bound to the recipient (anyone holding a forwarded link can join); acceptance can change an existing member's role; `expires_in` is unbounded; no rate limiting; guest invitation tokens never expire; token hashes are readable (F1). |
| Unauthorized guest group access | **No (by design today)** | There is no group-level access. Every member sees every group and guest. |

## 3. Findings

Severity is relative to the Planning Team goal (multiple people with different trust levels in one wedding).

### F1 — Token-hash column revokes are ineffective (High as a control failure, Low practical impact)

`20260325120300_rls_policies.sql` runs `revoke select (token_hash) on public.wedding_invites/invitations from anon, authenticated` (and insert/update on `wedding_invites`). In PostgreSQL a column-level REVOKE does not override a **table-level** grant, and Supabase grants `anon` and `authenticated` full table privileges on public tables. Live result:

```
has_column_privilege('authenticated','public.wedding_invites','token_hash','SELECT') = t
has_column_privilege('anon',         'public.wedding_invites','token_hash','SELECT') = t
has_column_privilege('authenticated','public.invitations',   'token_hash','SELECT') = t
has_column_privilege('authenticated','public.wedding_invites','token_hash','UPDATE') = t
has_column_privilege('authenticated','public.invitations',   'token_hash','INSERT') = t
```

Effect: owners can select `wedding_invites.token_hash` for their wedding; every member can select `invitations.token_hash`; writers can insert/update guest invitation hashes directly. Because tokens are 256-bit random, a hash does not reveal the link, so the practical risk is low, but `docs/database-security.md` claims the opposite and the SQL test that should catch this swallows every exception (`when others then null`), so it passes regardless.

Fix (Milestone 2): revoke table-level SELECT/INSERT/UPDATE on these two tables from API roles and re-grant column lists without `token_hash` (or move hashes to a private table); fix the test to assert the error.

### F2 — Invite acceptance can change an existing member's role, including leaving a wedding with no owner (High)

`accept_wedding_invite` upserts `on conflict (wedding_id, user_id) do update set role = excluded.role`. An owner who opens any invite link for their own wedding becomes `viewer`/`collaborator`/… If they were the only owner, no path can ever create an owner again. It can also silently upgrade a `viewer`.

### F3 — Invites are not bound to the recipient (High)

The caller's email/phone is never compared with `invited_email`/`invited_phone` (known audit Q4). A forwarded or leaked link grants membership to whoever opens it first. Duplicate pending invites for the same address are allowed, and inviting an existing member is allowed.

### F4 — Owners are not protected from each other; owner count is unbounded (High)

`set_wedding_member_role` lets any owner demote another owner (only "last owner" is protected) and promote any member to owner. The owner count check is not concurrency-safe (no lock).

### F5 — No financial privacy (High)

See section 2. Every write-capable role can create, edit and delete expenses and payments and change the total budget; every member including `viewer` can read them. The dashboard (`WeddingDashboardScreen` via `useBudgetDashboard`) shows the total budget to every member.

### F6 — No guest contact privacy and no group scoping (High)

All members read all guests with all contact fields. Co-members read each other's `profiles.phone`.

### F7 — No member removal or leave; no access revocation (High for Milestone 5)

`wedding_members` has no DELETE path. Access cannot be revoked short of a database admin. There is no cleanup of `task_assignees` or `timeline_items.assigned_to`.

### F8 — Vendor team members can rewrite wedding-side rows, including `wedding_id` (Medium; outside Planning Team scope)

`wedding_vendors_update`, `vendor_inquiries_update` and `vendor_bookings_update` allow the vendor's team in both USING and WITH CHECK, with no column restriction. A vendor user can change `wedding_id` (moving a row into another wedding whose id they know), edit the couple's private `notes`, change `created_by`, `message`, `proposed_budget`, or booking amounts. Recommend a trigger that freezes `wedding_id`/`created_by` and limits vendor-side updates to status/quote fields. Track separately; not required for Planning Team but should be fixed before production.

### F9 — Wedding settings are writable by every writer, without column limits (Medium)

`weddings_update_writer` lets collaborators change `title`, partner names, `status`, `currency_code`, `style`, cover, and even `created_by`. The brief says owners manage wedding settings.

### F10 — `timeline_items.assigned_to` is not validated (Medium)

No trigger checks that the assignee is a member of the wedding. `task_assignees` does check this in its INSERT policy.

### F11 — `anon` can execute every RPC (Low, defence in depth)

`revoke all … from public` does not remove Supabase's explicit default grant to `anon`. All authenticated-only RPCs reject a null `auth.uid()`, so nothing is exploitable now, but every new RPC should explicitly `revoke execute … from anon`.

### F12 — Non-empty `search_path` on older SECURITY DEFINER RPCs (Low)

`create_wedding_invite`, `accept_wedding_invite`, `set_wedding_member_role`, `create_guest_invitation` use `public, extensions, private`; the two guest RPCs use `public, extensions` / `public, private`. `anon`/`authenticated` have no CREATE on those schemas (verified), so object shadowing is not possible today. All new functions should use `search_path = ''` with schema-qualified names, as `create_wedding` and the `private` helpers already do.

### F13 — Weak assertions in `security_foundation.sql` (Medium for process)

- Token-hash check: `exception when others then null` — always passes.
- Viewer task insert: catches all exceptions — passes on any error, including unrelated ones.
- No coverage for: two owners, owner-vs-owner changes, invite acceptance by a different account, acceptance by an existing member, financial privacy, guest-group isolation, member removal.

### F14 — No rate limiting or expiry on guest invitation tokens (Low)

Documented already in `docs/database-security.md`. Not a Planning Team blocker.

## 4. Function execution, search paths and SECURITY DEFINER review

| Function | Authorization inside | Notes |
| --- | --- | --- |
| `create_wedding` | `auth.uid()` required; creator becomes owner | `search_path=''`, schema-qualified. Good. |
| `create_wedding_invite` | `is_wedding_owner` | Unbounded `p_expires_in`; no duplicate check; F11, F12. |
| `accept_wedding_invite` | `auth.uid()` required | F2, F3, F11, F12. |
| `set_wedding_member_role` | `is_wedding_owner` | F4, F11, F12. |
| `create_guest_invitation`, `mark_guest_invitation_sent` | `can_write_wedding` | Will need `guests.send_invitations` + group scope. |
| `get_guest_invitation_by_token`, `submit_guest_invitation_rsvp` | token only (intended for anon) | Return no contact data; fine. |
| `private.*` membership helpers | `auth.uid()` inside, `search_path=''` | Safe to keep; they are the pattern to extend (`has_wedding_permission`). |

## 5. Service role usage

Not used anywhere in app code, scripts or tests (`rg` finds nothing). `.env.example` marks it scripts-only. Good. Planning Team needs no service-role path: every operation can be an authenticated `SECURITY DEFINER` RPC with explicit checks.

## 6. Client-side vs backend authorization

- The client hides controls with `useWeddingRole().canWrite` (role ≠ viewer). The code comment correctly states RLS is the enforcement. This is fine as UX, and every hidden action is also blocked by RLS today **for the viewer/writer split only**.
- Two places compute roles separately (`TaskDetailScreen` direct query; `vendorService.canWriteWedding`). They will drift once permissions are added; they must move to one access hook backed by a database RPC.
- No client check exists for financial access, group access, or team management, because no backend rule exists either. Hiding the Budget card in the UI would not be security; the RLS policies must change first.

## 7. Cross-wedding foreign-key integrity

| Reference | Guarded? |
| --- | --- |
| task → event, task → parent task | Trigger |
| guest → group | Trigger |
| invitation → guest/group/design; invitation_events → event | Trigger |
| RSVP guest/event; seating table/event/guest | Trigger |
| budget_item → wedding_vendor/booking | Trigger |
| wedding_files → task/booking | Trigger |
| wedding_vendors/inquiries → event | Trigger |
| task_assignees.user_id is a member | RLS INSERT check |
| timeline_items.assigned_to is a member | **Not guarded** (F10) |
| wedding_vendors / vendor_inquiries `wedding_id` changed by vendor team | **Not guarded** (F8) |
| future: permission rows, coordinator rows → same wedding's members/groups | Must be designed in (composite FKs, doc 06) |

## 8. Storage

| Bucket | Read | Write | Planning Team impact |
| --- | --- | --- | --- |
| `wedding-documents` (private) | any member | writer | Receipts and contracts are financial; need `documents.*` / budget permissions (or a separate path prefix for financial files). |
| `wedding-covers` (public) | anyone with URL | writer | Should follow `wedding.settings.manage` (owner). |
| `avatars` (public) | anyone with URL | self | No change. |

## 9. Realtime

No tables are published. There is no realtime leakage risk today. If realtime is added later, Supabase Realtime applies RLS to `postgres_changes`, but the new permission policies must be in place first.
