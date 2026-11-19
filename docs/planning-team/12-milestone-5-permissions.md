# Planning Team — 12. Milestone 5: permission management

Status: **implemented locally.** Applied to the local Supabase stack. Nothing deployed.

## 1. Database

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261106120000_team_permission_rpcs.sql` | D8 `item_kind`, D9 backfill, permission RPCs, settings + budget summary, guest-invite auth helper, `list_team_members` → `team.view` |
| `supabase/migrations/20261106120100_team_permission_rls.sql` | Feature-table RLS switched from `can_write_wedding` to permission helpers |

### Behaviour

- **D8** — `budget_items.item_kind` is `allocation` \| `expense`. Onboarding rows from `create_wedding` are allocations. Heuristic backfill marks rows without vendor/booking/committed/payments as allocations; everything else becomes expense.
- **D9** — Existing non-owners received template permissions. Legacy `partner` / `planner` / `collaborator` keep all grantable keys. Existing `viewer` rows get every `*.view` key plus `guests.contacts.view` so the RLS switch does not remove prior read access.
- **`set_member_role_template`** — owner only; cannot target owners or self; optionally resets permissions to the template.
- **`set_member_permissions`** — owner only; expands dependencies via `private.expand_permissions`; rejects reserved / unknown keys.
- **`update_wedding_settings`** — requires `wedding.settings.manage` (owners). Direct `UPDATE` on `weddings` is no longer allowed for clients.
- **`get_budget_summary`** — requires `budget.view`. Returns totals and per-category allocation/expense aggregates without exposing expense-line RLS.
- **Guest invitations** — create/send paths require `guests.send_invitations` (or group coordinator flag via `private.can_send_guest_invitations`).
- **RLS** — guests, tasks, timeline, vendors (wedding-side), budget, documents, covers, activity, and related tables use `has_wedding_permission` / group helpers. Owners still short-circuit inside the helpers.

## 2. Application

- `updateWedding` calls `update_wedding_settings` (settings / cover flow).
- `legacyCanWrite` / `useWeddingAccess.canWrite` derive from effective permissions (any create/update/delete/manage/assign/comment write key).
- `teamService.setMemberRoleTemplate` / `setMemberPermissions` ready for Milestone 8 UI.
- `budgetService.getBudgetSummary` ready for dashboard surfaces that only have `budget.view`.

No Planning Team permission screens yet (Milestone 8). Group-scoped guest isolation beyond wedding-wide keys is Milestone 6.

## 3. Tests

| Suite | Result |
| --- | --- |
| `planning_team_permissions.sql` (templates, reserved keys, task vs budget RLS, revocation, summary, settings RPC) | PASS |
| Existing foundation / membership / invites / security suites | PASS (updated for permission RLS + template grants in fixtures) |
| Vitest: `legacyCanWrite` permission-derived | included in `npm test` |

`npm run db:test:security` now runs all five SQL suites.

## 4. Still deferred

- Group-scoped guest RLS refinements and coordinator RPCs — done in Milestone 6 (doc 13).
- Task assignee column-limit trigger and comment rules — done in Milestone 7 (doc 14).
- Permission / team management screens (Milestone 8).
- Production apply — local only until explicitly approved.
