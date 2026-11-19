# Planning Team — 15. Milestone 8: Planning Team UI

Status: **implemented locally.** No new migrations. Nothing deployed.

## 1. Screens and routes

| Route | Screen | Access |
| --- | --- | --- |
| `weddings/[weddingId]/team` | `TeamOverviewScreen` | `team.view` (or owner) |
| `team/invite` | `InviteMemberScreen` | Owner |
| `team/invitations` | `PendingInvitesScreen` | Owner |
| `team/activity` | `ActivityScreen` | `activity.view` (or owner) |
| `team/[userId]` | `MemberDetailScreen` | `team.view` |
| `team/[userId]/permissions` | `PermissionEditorScreen` | Owner |
| `team/groups/[groupId]` | `GroupCoordinatorsScreen` | Owner |
| `join/[token]` | `JoinInviteScreen` | Already shipped in M4 |

Entry: **Planning team** card at the top of `WeddingMoreScreen` (hidden without `team.view`). Guest groups: **Coordinators** on each group row for owners.

## 2. Application pieces

- Components: `MemberRow`, `RoleTemplatePicker`, `PermissionToggleList`, `InviteStatusBadge`, `ActivityRow`
- Validation: `validation/teamSchemas.ts` (email, invite kind, template, expiry)
- Labels: `permissionLabels.ts` (grantable categories; reserved keys never toggled)
- Queries: mutations for role/permissions/coordinators; `useTeamActivity`, `useMemberPermissions`, `useGroupCoordinators`
- Services: `listMemberPermissions`, `listRoleTemplatePermissions`, `listGroupCoordinators`, `listMemberCoordinations`, `listTeamActivity`
- More screen also hides Budget / Timeline / Documents when the member lacks the matching view permission

Owner-only UI is gated in screens; RPCs/RLS remain the enforcement layer.

## 3. Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Vitest `src/features/team` | PASS |
| New SQL | none (M8 is UI-only) |

## 4. Still deferred

- Dashboard shortcut tile for owners (optional in doc 07)
- Production apply — local only until explicitly approved

Multi-role integration/security pass landed in Milestone 9 (doc 16).
