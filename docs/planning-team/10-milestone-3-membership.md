# Planning Team — 10. Milestone 3: membership and workspace management

Status: **implemented locally.** Milestone 2 migrations were applied to the local stack as a prerequisite. Nothing was deployed.

## 1. Database

| File | Purpose |
| --- | --- |
| `supabase/migrations/20261106100000_team_membership.sql` | `list_team_members`, `remove_member`, `leave_wedding`, plus `private.clear_member_work_assignments` |

### Behaviour

- **`list_team_members(wedding_id)`** — any current member of that wedding. Returns ordered JSON (owners first) with display name, avatar, role, joined_at, invited_by, is_owner, is_self. Phone is included only for owners. Authorization matches today's `wedding_members` SELECT (any member); `team.view` gating waits for the Milestone 5 permission backfill.
- **`remove_member(wedding_id, user_id)`** — owner only. Rejects owners, self-removal, and missing members. Deletes membership (permissions and coordinators cascade), clears that person's `task_assignees` and `timeline_items.assigned_to` for the wedding, writes `member.removed` to the activity log.
- **`leave_wedding(wedding_id)`** — self only. An owner may leave only when another owner remains (sets `kiburan.allow_owner_change` for that transaction). Same assignment cleanup and `member.left` activity entry. Sole-owner leave is blocked.

## 2. Application

```
src/features/team/
  permissions.ts
  types.ts
  queries.ts                 useWeddingAccess, useTeamMembers, remove/leave mutations
  services/teamService.ts
  services/teamErrors.ts
  services/teamService.test.ts
  utils/roleLabels.ts
  utils/roleLabels.test.ts
```

- Query keys: `myAccess`, `teamMembers` (user- and wedding-scoped).
- **`useWeddingAccess`** reads `get_my_wedding_access`. Exposes `can(permission)`, `canInGroup`, `isOwner`, and legacy `canWrite`.
- **`useWeddingRole`** is now a shim over `useWeddingAccess`. `canWrite` still means "role is not viewer" until Milestone 5 backfills permissions and switches RLS, so existing screens keep their current behaviour.
- **`WeddingListCard`** shows human role labels ("Owner", "Family coordinator", …).
- **`TaskDetailScreen`** no longer queries `wedding_members` directly; it uses `useWeddingRole`.
- **`vendorService.canWriteWedding`** uses `get_my_wedding_access` + the same legacy write rule.

No Planning Team screens or routes yet (Milestone 8). No invite redesign (Milestone 4).

## 3. Tests

| Suite | Result |
| --- | --- |
| `planning_team_membership.sql` (workspace isolation, remove cleanup, immediate access loss, sole-owner leave block, anon denied) | PASS |
| Existing `security_foundation.sql` + `planning_team_security.sql` | PASS (after M2 apply) |
| Vitest: `roleLabels`, team access helpers, query-key scoping | included in `npm test` |
| `npm run typecheck` / `npm run lint` | run as part of this milestone |

`npm run db:test:security` now runs all three SQL suites.

## 4. Still deferred

- Permission-row backfill for existing non-owners (D9 / Milestone 5).
- Tightening `list_team_members` to `team.view`.
- Team invite RPCs and `app/join/[token]` (Milestone 4).
- Planning Team UI screens (Milestone 8).
- Concurrent two-session owner-limit stress test (Milestone 9).
