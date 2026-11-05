# Planning Team — 09. Milestone 2: collaboration database foundation

Status: **written and tested locally inside rollback-only transactions. Not applied to any database, not deployed.** Waiting for review and approval to apply locally.

## 1. Migrations

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261106090000_team_hardening.sql` | Closes audit findings F1, F2, F3 (binding, duplicates, expiry), F4, F9 (`created_by` only), F10, F11 |
| `supabase/migrations/20261106090100_team_foundation.sql` | Ownership invariants, role values, permission catalog, role templates, member permissions, guest group coordinators, helpers, `get_my_wedding_access` |
| `supabase/migrations/20261106090200_team_activity.sql` | Activity log, guest and group attribution, guest and group activity triggers |

`reference/kiburan_schema.sql` and all earlier migrations are unchanged. No table or column is dropped; every change is additive except the replaced role check constraints (superset of the old values) and the replaced grants on `wedding_invites` and `invitations`.

## 2. What each guarantee is and where it is enforced

### Equal ownership

- Every wedding has one or two owners. Enforced by `wedding_members_owner_count` (after insert, role update or delete), which locks the `weddings` row first so concurrent changes serialize. The migration refuses to apply if any existing wedding breaks the rule.
- Owners cannot be created, demoted or removed by plain writes from a signed-in context (`wedding_members_guard_change`). Allowed paths: the creator's first owner row inside `create_wedding`; transactions that set `kiburan.allow_owner_change = 'on'` (reserved for the Milestone 4 and 5 ownership RPCs); database administrators and the service role (no `auth.uid()`); and the cascade when a whole wedding is deleted.
- `set_wedding_member_role` can no longer grant or change the owner role, so one owner cannot promote others or demote the other owner.
- `accept_wedding_invite` never changes an existing membership, so it cannot downgrade an owner.
- Membership `wedding_id` and `user_id` are immutable.
- When a member becomes an owner, their permission rows are deleted: ownership implies every permission.

### Permission architecture

- `wedding_permission_catalog`: the 33 keys from doc 05, with category, label, `is_grantable` (false for the four owner-reserved keys), `is_financial` and direct prerequisites.
- `wedding_role_templates`: default permissions for co_host, planner, family_coordinator, task_manager, viewer and custom (matching doc 05), plus legacy partner and collaborator, which get every grantable permission to match today's behaviour (decision D9). The migration asserts no template contains a reserved key or misses a prerequisite.
- `wedding_member_permissions`: effective permissions for non-owners. Foreign key to the membership (removed with it), rejects reserved or unknown keys and rejects rows for owners.
- `private.has_wedding_permission(wedding, key)`: true for owners (any catalog key) or a matching row; false for unknown keys.
- `public.get_my_wedding_access(wedding)`: role, `is_owner`, permissions and coordinated groups for the caller. Display only; it never authorizes anything.

### Guest group coordinators

- `guest_group_coordinators` (group, member, `can_delete` default off, `can_send_invitations` default on). Composite foreign keys guarantee the group and the member belong to the same wedding, and a coordinated group cannot be moved to another wedding.
- `private.can_access_guest_group(wedding, group, capability)` with capabilities `view`, `create`, `update`, `delete`, `send_invitations`: wedding-wide permission or a coordinator row for that exact group. Ungrouped guests are never reachable through coordination.

### Activity history and attribution

- `wedding_activity_log`: append-only. No client insert, update or delete; rows are written by `private.log_activity`, which API roles cannot execute. Owners read everything; other members need `activity.view` plus the entry's `required_permission` (guest entries require `guests.view`).
- Guests gain `created_by`, `updated_by`, `updated_at`; guest groups gain `created_by`. The trigger takes the actor from `auth.uid()` and ignores client-supplied values; `created_by` never changes.
- Summaries contain names and the names of changed fields, never contact details or amounts.

### Invitation hardening (team invites)

- Email required and normalized; phone-only invites rejected until phone sign-in exists (decision D5).
- Lifetime 1 hour to 30 days; one pending invite per email per wedding; no invite for someone who is already a member.
- Acceptance requires a confirmed email that matches the invite. A wrong-account attempt does not consume the invite.
- Only the role values of the old model are offered for invites and role changes. New role templates become invitable in Milestone 4 and 5 together with the permission RPCs.

### Other hardening

- `token_hash` on `wedding_invites` and `invitations` is no longer readable or writable by API roles; both tables accept inserts only through their RPCs. The app already never selected or wrote these columns.
- `anon` can no longer execute `create_wedding`, the team invite RPCs, `set_wedding_member_role`, `create_guest_invitation` or `mark_guest_invitation_sent`. Guest RSVP token RPCs remain anonymous.
- `weddings.created_by` is immutable; timeline assignees must be members of the event's wedding.

## 3. Deliberately not changed in Milestone 2

- Feature-table RLS still uses `can_write_wedding` / `is_wedding_member`. Switching guests, tasks, budget, vendors, timeline and documents to the permission helpers is Milestone 5, so the current app keeps working unchanged.
- No permission rows are backfilled for existing members. Before Milestone 5 switches RLS, existing non-owners must receive their template's permissions (decision D9), otherwise they lose access.
- New role values (co_host, family_coordinator, task_manager, custom) exist in the schema but nothing can assign them yet. Under the current policies they would behave like `viewer`, which is the safe direction.
- `budget_items.item_kind` (D8), the guest contact privacy split (D7), member removal and leave (F7), vendor-side fixes (F8), owner-only wedding settings (rest of F9), the older RPCs' `search_path` (F12) and guest token expiry (F14) remain on the roadmap.
- The guest attribution columns and new tables are not in `src/types/database.ts` until types are regenerated after applying.

## 4. Tests run

All runs used the local stack, inside a transaction that applied the three migrations and was rolled back at the end. Nothing persisted.

| Run | Result |
| --- | --- |
| Three migrations against the current local data (155 weddings, 183 users) | Applied cleanly, preflight passed |
| `supabase/tests/security_foundation.sql` (tightened, see below) on top of the migrations | PASS |
| `supabase/tests/planning_team_security.sql` (new, 92 assertions) on top of the migrations | PASS |
| New suite without the migrations | FAIL at the first check, as expected |
| Mutation checks: new suite after deliberately re-adding the `token_hash` grant, dropping the owner guard, dropping the owner-count trigger, dropping the permission validator, loosening the activity policy, re-granting `anon` execute | Each mutation caught by a FAIL |

Changes to `security_foundation.sql`: the `token_hash` and viewer-task checks now require an actual permission error instead of swallowing every error; the expired-invite case creates a valid invite and backdates it, because negative lifetimes are now rejected, and uses the invited account so it tests expiry rather than email binding.

`scripts/run-security-tests.mjs` (`npm run db:test:security`) now runs both suites. Both need the new migrations applied, so the command fails until then.

Not yet run, because they need the migrations applied: `supabase migration up` or `db:reset`, `db:types`, `typecheck`, `lint`, the vitest integration suites, and a two-session concurrency test of the owner limit (planned for Milestone 9).

## 5. Open questions introduced or sharpened by this milestone

1. **Legacy viewers.** Existing `viewer` members can read the budget and guest list today. The new `viewer` template has neither. D9 has to say whether existing viewers keep legacy access at the Milestone 5 switch.
2. **New `collaborator` invites.** The legacy collaborator template includes budget permissions. New invites with role `collaborator` should probably map to a non-financial template in Milestone 4.
3. **Sole-owner account deletion.** Deleting the account of a wedding's only owner now fails on the owner-count rule instead of leaving an ownerless wedding. The account deletion policy (audit Q3) needs to decide what happens instead.
4. **Production.** No production database was inspected (D13). The preflight block stops the foundation migration if any wedding there has zero or more than two owners.
