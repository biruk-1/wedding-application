# Planning Team — 16. Milestone 9: integration and security testing

Status: **implemented locally.** No new migrations. Nothing deployed.

## 1. What was verified

Full local cast on one wedding plus a second wedding:

| Account | Role |
| --- | --- |
| owner A / owner B | equal owners |
| co-host, planner, task manager, viewer, custom | templates |
| bride / groom family coordinators | group-scoped |
| outsider | no membership |
| second-wedding owner | workspace B only |
| invitee | accept / revoke / expire path |

Scenarios covered in `supabase/tests/planning_team_integration.sql`:

- Equal owners (list, invite, cannot remove/demote each other)
- Co-host / planner cannot invite or edit permissions
- `get_my_wedding_access` shapes (task manager, viewer, custom, coordinator groups)
- Bride vs groom guest isolation (read + blocked cross-group update)
- Budget isolation (task manager, viewer, co-host default; owner summary OK)
- Documents isolation (viewer without `documents.view`; co-host / task manager with it)
- Invite revoke, expiry, wrong-account, successful custom join
- Cross-wedding isolation and planner membership on wedding B
- Concurrent guest/task edits by permitted writers
- Third co-owner invite blocked when two owners already exist

Prior milestone suites still cover foundation, membership, invites, permissions, guests, and tasks in depth.

## 2. App / unit checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` (228 tests, incl. `permissionLabels.test.ts`) | PASS |
| `npm run db:test:security` (8 SQL files) | PASS |
| Guest integration regression | Cross-wedding list RPCs now hard-deny non-members; test updated |

## 3. Manual device pass (optional checklist)

Automated SQL covers enforcement. On a device/simulator, spot-check when convenient:

1. Owner: More → Planning team → invite → share → accept on second account
2. Non-owner: invite / permission editor screens show owners-only empty states
3. Family coordinator: guest list scoped to assigned group
4. Task manager: checklist works; Budget/Documents tiles hidden or denied as expected
5. Switch weddings: planner with two memberships sees separate workspaces

## 4. Still deferred

- Production apply of M2–M7 (+ inbox) migrations — local only until explicitly approved
- HTTPS universal links / invite email provider (product follow-up)
- Platform ownership-dispute procedure (D4) — out of app scope

Dashboard Team shortcut + invitee inbox landed in doc 17.
