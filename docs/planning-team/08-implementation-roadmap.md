# Planning Team — 08. Implementation roadmap

Milestones 1–9 plus finish polish (docs 09–17) are implemented locally. Nothing is deployed.

Global rules for every milestone: migrations are additive and reviewed before applying; applied only to the local stack (`npm run db:reset`) until explicitly approved; types regenerated (`npm run db:types`); `npm run typecheck`, `npm run lint`, `npm test`, and both SQL security suites pass before a milestone is declared done; no service-role key in the app; no fake data in shared environments.

## 1. Milestones

### Milestone 2 — Collaboration database foundation

| Step | Work | Done when |
| --- | --- | --- |
| 2.0 | Commit/stash the current uncommitted UI work so database changes are reviewed alone. Run the assertion queries (owners per wedding, non-owner roles in use, pending invites) against **every** target database, including production if it exists. | Results recorded in this folder |
| 2.1 | Hardening migration (doc 06 §4 file 1): token-hash privileges (F1), anon EXECUTE revokes (F11), `created_by` immutable, timeline assignee trigger (F10), hardened `set_wedding_member_role` (F4) and `accept_wedding_invite` (F2) | Existing app still works; fixed tests prove each gap is closed |
| 2.2 | Foundation migration: role superset, `wedding_members` columns, owner-count trigger (1–2 owners, wedding-row lock), permission catalog, role templates, `wedding_member_permissions`, `guest_group_coordinators`, `guest_groups (id, wedding_id)` unique | All 155 local weddings unchanged; trigger rejects a 3rd owner and the last-owner removal, including concurrently |
| 2.3 | Activity log + guest attribution (+ `budget_items.item_kind` if D8 approved) | Triggers write attribution from `auth.uid()` only |
| 2.4 | Helper functions `has_wedding_permission`, `can_access_guest_group`, `log_activity`; `get_my_wedding_access` RPC | Unit-level SQL tests per helper |
| 2.5 | Fix `security_foundation.sql` (F13) and add `planning_team_security.sql` skeleton | Suites fail on purpose when a policy is loosened |

RLS policy replacement for feature tables is deliberately deferred to Milestone 5 so the existing app keeps working while the foundation lands; in Milestone 2 the new tables get their own strict RLS.

### Milestone 3 — Membership and workspace management

Done locally (doc 10):

- `list_team_members`, `remove_member`, `leave_wedding` RPCs with cleanup of `task_assignees` / `timeline_items.assigned_to`.
- `src/features/team/` skeleton: services, `useWeddingAccess`, query keys.
- `WeddingListCard` role labels; `useWeddingRole` shim; TaskDetail / vendor write lookups unified.
- SQL + unit tests for workspace isolation and immediate access loss after remove/leave.

### Milestone 4 — Invitation system

Done locally (doc 11):

- `wedding_invites` extension + create/resend/revoke/list/preview/accept RPCs (email-bound, co-owner cap, permissions + group snapshot on accept).
- `app/join/[token].tsx` + pending-invite storage; auth redirect resumes join after sign-in/register.
- SQL + unit tests for wrong account, expiry, revoke, duplicate, co-owner, and reuse.

### Milestone 5 — Permission management

Done locally (doc 12):

- `set_member_role_template`, `set_member_permissions` RPCs with dependency closure and reserved-key rejection.
- Feature-table policies replaced with permission helpers (doc 05 §6); old policies dropped in the same migration transaction.
- Budget: `get_budget_summary`; `item_kind` allocation/expense split (D8); storage receipts gated.
- Settings: `update_wedding_settings` + cover uploads; direct wedding UPDATEs removed for clients.
- D9 backfill for existing non-owners; guest invite auth uses `guests.send_invitations`.
- SQL + unit tests for template grants, reserved keys, task/budget isolation, revocation, and settings RPC.

### Milestone 6 — Shared guest management

Done locally (doc 13):

- Group-scoped guest RLS (from M5) plus coordinator assign/unassign RPCs; contact privacy per D7 (column grants + safe directory RPCs).
- Family groups via `ensure_family_guest_groups` (D10); group picker limited to writable/coordinated groups; `get_guest_stats` for scoped totals.
- `delete_guest` / `delete_guest_group` RPCs; invitation designs readable by senders/coordinators.
- Attribution on guest detail; owners retain full activity visibility from earlier milestones.

### Milestone 7 — Tasks and collaboration

Done locally (doc 14):

- "Assigned to me" checklist tab and dashboard **Your tasks**; `set_task_assignees` RPC (atomic).
- Assignee status-update record rule (trigger limits columns without `tasks.update`).
- Comments for `tasks.comment` and assignees; task activity entries on detail.

### Milestone 8 — Planning Team UI

Done locally (doc 15):

- Team overview, invite, pending invites, member detail, permission editor, activity, group coordinators.
- Entry on `WeddingMoreScreen`; coordinator entry on `GuestGroupsScreen`.
- Owner-only routes guarded in UI (database already enforces); skeletons / empty / error patterns match other features.

### Milestone 9 — Integration and security testing

Done locally (doc 16):

- `planning_team_integration.sql` — full multi-role cast and scenarios (equal owners, demote block, invite deny, group/budget/documents isolation, invite revoke/expire, workspace isolation, concurrent edits, co-owner cap).
- Wired into `npm run db:test:security` (8 SQL suites).
- Guest integration test updated for hard deny on cross-wedding list RPCs; full Vitest pass.

### Finish polish (after M9)

Done locally (doc 17):

- Invitee inbox RPCs + wedding-selector Join UI.
- Dashboard Team shortcut; permission-aware feature tiles.
- Invite-screen copy clarifying share-sheet delivery (no email provider).

### Passwordless invite auth

Done locally (doc 18):

- Invite join flow uses Supabase email OTP (no password required for invitees).
- `validate_team_invite_email` before OTP; accept still enforced server-side.
- Password login/register/reset preserved.

## 2. Unresolved decisions (need product/PM answers)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Store templates as new `wedding_members.role` values (superset check) or as a separate column | Superset of `role` values (additive, no row rewrite) |
| D2 | Meaning of the legacy `partner` role | Keep valid, stop offering it; treat existing `partner` rows as collaborators with legacy permissions; owners can upgrade a partner to co-owner only via co-owner invite |
| D3 | Do non-wedding celebrations (birthday, graduation, …) also allow two owners? | Yes, same rule (max 2) for all kinds |
| D4 | Ownership deadlock (other owner unreachable, dispute) with no platform admin | Support-only service-role procedure outside the app, audited; out of app scope |
| D5 | Recipient binding: email only, or phone too? | Email only (app has no phone auth). Phone invites disabled for team invites until phone auth exists |
| D6 | Require email confirmation in production? | Yes. Without it, email binding proves nothing |
| D7 | Guest contact privacy granularity (`guests.contacts.view`) | Adopt it; implement via RPC/view nulling contact columns |
| D8 | Distinguish budget allocations from expenses (`budget_items.item_kind`) | Adopt with reviewed backfill heuristic |
| D9 | Existing non-owner members (production): keep legacy full access or apply new restrictive defaults | Keep legacy access for existing rows, flag for owner review; new invites use new defaults |
| D10 | Auto-create "Bride's family"/"Groom's family" groups | Offer as an action, not automatic |
| D11 | Activity log retention and whether collaborators see it | Keep indefinitely; collaborators see entries only with `activity.view` + required permission |
| D12 | Invite preview without a session (anon) | Allow minimal preview (wedding title, inviter first name, role label) to help new users decide to register |
| D13 | Production database state | Must be inspected before Milestone 2 migrations are proposed for deployment; only local was audited |
| D14 | Fix vendor-side update gap (F8) in the same release | Yes, separate migration, same release |
| D15 | Should `wedding planner` get budget access by default? | No (brief: no financial access unless explicitly granted) |

## 3. Risks

| Risk | Mitigation |
| --- | --- |
| Policy rewrite (Milestone 5) breaks existing screens for current users | Owners keep full access through the owner short-circuit; migrate one table at a time; run all integration tests per step |
| Production has data that violates new invariants (e.g. weddings with 0 or >2 owners, `partner` rows) | Assertion queries before applying (step 2.0); migrations fail loudly instead of guessing |
| Owner-count trigger blocks account deletion of a sole owner | Explicit part of the account-deletion decision (schema-audit Q3) |
| RLS helper calls per row slow large guest lists | Helpers are `STABLE` and wrapped as `(select …)` in policies; indexes on `wedding_member_permissions`, `guest_group_coordinators (wedding_id, user_id)`, `guests (group_id)`; measure with `scripts/perf/measure-data-flows.mjs` |
| Stale permissions in UI after an owner changes them | RLS enforces immediately; UI refreshes on focus and within 60 s |
| Forwarded invite links | Email binding (D5/D6); short default expiry; revoke/resend |
| Scope creep from unrelated hardening | Only items the Planning Team depends on are in Milestone 2; others tracked separately |
| Dirty working tree mixes UI and schema changes | Step 2.0 |

## 4. Deliverables per milestone

Each milestone ends with: reviewed migrations (local only), regenerated types, updated docs in this folder, passing test suites, and a short report of what changed and what was verified. No milestone starts automatically.
