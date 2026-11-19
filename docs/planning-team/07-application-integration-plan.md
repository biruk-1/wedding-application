# Planning Team — 07. Application integration plan

Status: plan + implemented through finish polish (docs 15–17). Services/queries from M3–M7; team screens from M8; integration tests M9; dashboard shortcut + invitee inbox doc 17.

The goal is to add the Planning Team to the existing app shape: Expo Router routes under `app/(app)/weddings/[weddingId]/`, feature code under `src/features/`, TanStack Query hooks with user-scoped keys, and the existing UI kit (`src/components/ui`, `Screen`, `Header`, `Card`, `Button`, `Badge`, skeletons) and adaptive Ethiopian themes (`useColors`, `useThemedStyles`, `WeddingThemeContext`). No second design system.

## 1. New feature module

```
src/features/team/
  services/teamService.ts        RPC wrappers (create/revoke/resend/accept invites, members, permissions,
                                 coordinators, remove/leave, access, activity)
  services/teamSelects.ts        column lists (never token_hash)
  services/teamErrors.ts         maps RPC exceptions to user messages
  services/teamService.integration.test.ts
  queries.ts                     useWeddingAccess, useTeamMembers, useTeamInvites, useActivity, mutations
  permissions.ts                 permission keys + labels (mirrors wedding_permission_catalog; types generated)
  screens/                       TeamOverviewScreen, InviteMemberScreen, MemberDetailScreen,
                                 PermissionEditorScreen, PendingInvitesScreen, ActivityScreen,
                                 JoinInviteScreen
  components/                    MemberRow, RoleTemplatePicker, PermissionToggleList, GroupCoordinatorPicker,
                                 InviteStatusBadge, OwnerBadge, ActivityRow
  validation/teamSchemas.ts      zod (email, expiry, template)
  types.ts
```

New query keys in `src/lib/query/queryKeys.ts` (all under `['u', userId, 'wedding', weddingId, …]`): `myAccess`, `teamMembers` (reuse existing `weddingMembers`), `teamInvites`, `groupCoordinators`, `activity`. The public join preview is token-keyed like the existing `publicInvite`.

## 2. Where each capability lives

| Capability | Location | Notes |
| --- | --- | --- |
| **Planning Team entry point** | New "Planning team" card at the top of `WeddingMoreScreen` (`src/features/weddings/screens/WeddingMoreScreen.tsx`), above "Planning". Optional shortcut tile in `FeatureShortcutGrid` on the dashboard for owners. | Visible to anyone with `team.view`; invite/manage actions only for owners. Keep the 5-tab `WeddingTabBar` unchanged. |
| Team overview / member list | `app/(app)/weddings/[weddingId]/team/index.tsx` → `TeamOverviewScreen` | Owners shown first with an "Owner" badge; both owners shown identically. Pending invite count for owners. |
| Invite member | `team/invite.tsx` → `InviteMemberScreen` (slide-from-bottom, like other forms) | Owner-only route; email, role template, permission preview, group assignments, expiry. Shares the link via the native share sheet (same pattern as guest invitations; there is no email/SMS provider). |
| Pending invitations | `team/invitations.tsx` → `PendingInvitesScreen` | Owner-only. Status (pending/accepted/expired/revoked), resend, revoke. |
| Member details | `team/[userId]/index.tsx` → `MemberDetailScreen` | Role label, groups coordinated, assigned tasks count; owner actions: change template, edit permissions, remove. Self: "Leave this wedding". |
| Permission editor | `team/[userId]/permissions.tsx` → `PermissionEditorScreen` | Owner-only. Grouped toggles by category; financial section visually separated and off by default; reserved permissions not shown as toggles. |
| Guest group coordinator management | Two entry points: member detail ("Groups this person manages") and `GuestGroupsScreen` (`guests/groups.tsx`: "Coordinators" on each group row) | Owner-only edits; coordinators see their own assignments read-only. |
| Family guest groups | Existing `GuestGroupsScreen` | Label `side = partner_one/partner_two` groups with the partner names ("Bride's family", "Groom's family") using existing `celebrationCopy`. Optional "Create family groups" action. No new table. |
| Assigned tasks | `ChecklistScreen`: new "Assigned to me" filter in `TaskFilterBar`; dashboard `UpcomingTaskCard` area: "Your tasks" section | Uses `task_assignees.user_id` (already indexed). |
| Activity history | `team/activity.tsx` → `ActivityScreen`; per-task history section in `TaskDetailScreen`; per-guest "Added by / last edited by" line in `GuestDetailScreen` | Filtered server-side by permission. |
| Invitation acceptance | New root route `app/join/[token].tsx` → `JoinInviteScreen` | **Must not reuse `app/invite/[token].tsx`**, which is the public guest RSVP page. |
| Workspace switching | Existing `WeddingSelectorScreen` (`app/(app)/weddings/index.tsx`) + `WeddingListCard` | Show role badge ("Owner", "Family coordinator") per wedding; list pending team invites for the signed-in user at the top. The `weddingId` URL segment remains the active workspace. |

## 3. Invitation acceptance flow (signed-out and new users)

1. Owner shares `kiburan://join/<token>` (plus a web URL later).
2. `app/join/[token].tsx` opens. Root `_layout.tsx` must register `join/[token]` in the Stack.
3. If signed out: show the invite preview (decision D12: preview needs a session or allows anon), then "Sign in" / "Create account" with the invited email pre-filled. The raw token is kept in memory and in `authStorage`-style secure storage as a **pending invite** (cleared after accept, reject, or 24 h).
4. `resolveAuthRedirect` change: treat `join` like `invite` (do not redirect away). After sign-in/sign-up, if a pending invite exists, route to `/join/<token>` instead of `/(app)`. This is the only auth-flow change and needs approval (rule 12).
5. Signed in: show wedding title, inviter, role label, and the access summary; "Join" calls `accept_team_invite`. On success: invalidate `memberships`, navigate to `/(app)/weddings/<id>`.
6. Errors mapped clearly: wrong account ("This invite was sent to a***@…; sign in with that email"), expired, revoked, already a member, wedding already has two owners.
7. If email confirmation is required in production, sign-up shows "check your email" and the pending invite resumes after the confirmation deep link.

## 4. Permission-aware UI (replacing `canWrite`)

- Add `useWeddingAccess(weddingId)` in `src/features/team/queries.ts`, backed by `get_my_wedding_access`. Returns `{ isOwner, role, can(permission), canInGroup(groupId, capability), isLoading }`.
- Keep `useWeddingRole` temporarily as a shim (`canWrite` computed from the new access) so screens can migrate one feature at a time without a big-bang change.
- Remove the duplicated role lookups in `TaskDetailScreen` (direct `wedding_members` query) and `vendorService.canWriteWedding`.
- Every hidden control must also be blocked by RLS (doc 05). When RLS returns zero rows or a 42501 error, existing error mappers show "You don't have access to this", not a crash.
- Permission changes made by an owner on another device: the affected member's cached access refreshes on focus (`subscribeAppFocus`) and on `staleTimes.wedding` (60 s). RLS enforces immediately regardless of UI staleness.

## 5. Screen classification

### Owner-only

| Screen / action | Current file |
| --- | --- |
| Invite member, pending invitations, permission editor, coordinator assignment, remove member, change role template | new `team/*` |
| Wedding settings: title, date, partner names, status, currency, style, cover photo | `SettingsScreen` (style picker), `WeddingDashboardScreen` (cover edit `onEdit`), `weddingService.updateWedding` |
| Ownership actions (co-owner invite, step down, ownership requests) | new `team/*` |
| Delete any task comment | `TaskDetailScreen` |

### Permission-aware (existing screens to update)

| Area | Screens | Permissions |
| --- | --- | --- |
| Dashboard | `WeddingDashboardScreen`, `FeatureShortcutGrid`, `WeddingProgressCard`, `UpcomingTaskCard` | Budget tile/total only with `budget.view` (and via `get_budget_summary`); guest stats only with guest access; tasks with `tasks.view` |
| Tasks | `ChecklistScreen`, `TaskDetailScreen`, `TaskFormScreen`, `TaskRow` | `tasks.*`; assignee status rule; "Assigned to me" |
| Guests | `GuestsScreen`, `GuestDetailScreen`, `GuestFormScreen`, `GuestGroupsScreen`, `SeatingScreen`, `GuestStatsHeader` | `guests.*` or group access; group picker limited to coordinated groups; contacts hidden without `guests.contacts.view`; seating needs `guests.manage_all` |
| Guest invitations | `CreateInvitationScreen`, `InvitationTrackingScreen`, `InvitationDesignsScreen` | `guests.send_invitations` or group flag |
| Vendors | `MarketplaceScreen`, `VendorProfileScreen`, `InquiryScreen` | `vendors.view/manage/inquiries.manage`; marketplace browsing stays open to all members |
| Budget | all `src/features/budget/screens/*` | `budget.*` split (view total, expense lines, payments, create/update/delete, manage allocations) |
| Timeline | `TimelineDashboardScreen`, `EventDetailScreen`, `EventFormScreen`, `TimelineItemFormScreen` | `timeline.view/manage`; assignee picker limited to members |
| Documents | `DocumentsScreen` | `documents.view/manage`; receipts gated by budget permissions |
| More | `WeddingMoreScreen` | Hide Budget/Documents buttons when the member has no access |
| Wedding list | `WeddingSelectorScreen`, `WeddingListCard`, `AppHomeHubScreen` | Role label per wedding |

## 6. Cross-wedding leakage safeguards in the app

- Every service call already filters by the route `weddingId` (e.g. `guestService.getGuest(weddingId, guestId)`); keep that pattern for team services.
- Query keys include `userId` and `weddingId`; `syncCacheOwner` clears the cache on account change. Switching weddings changes the key, so no data is shared between workspaces.
- `get_my_wedding_access` is keyed per wedding; never reuse one wedding's permissions for another.

## 7. Atomicity improvements needed in the client

- `checklistService.replaceAssignees` (delete then insert) should become a `set_task_assignees` RPC so a permission failure cannot leave a task with no assignees.
- `guestService.deleteGuestGroup` / `deleteGuest` (delete invitations, then row) should become RPCs, since group coordinators may have rights on one but not the other.
