# Planning Team — 11. Milestone 4: invitation system

Status: **implemented locally.** Applied to the local Supabase stack. Nothing deployed.

## 1. Database

`supabase/migrations/20261106110000_team_invites.sql`

### Schema on `wedding_invites`

- `invite_kind` (`collaborator` | `co_owner`)
- `permissions text[]`, `group_assignments jsonb` (snapshot applied on accept)
- `invited_email_normalized` (generated), `revoked_by`, `last_sent_at`
- Unique pending email per wedding; unique pending co-owner invite per wedding
- Direct UPDATE policy removed — revoke/resend are RPCs only

### RPCs

| RPC | Who | Notes |
| --- | --- | --- |
| `create_team_invite` | owner | Email-bound; 1h–30d expiry; template or explicit permissions; group assignments; co-owner capped at 2 |
| `resend_team_invite` | owner | Rotates token hash, extends expiry |
| `revoke_team_invite` | owner | Sets `revoked_at` / `revoked_by` |
| `list_team_invites` | owner | Derived status; never returns hashes |
| `get_team_invite_preview` | **anon + authenticated** (D12) | Title, inviter name, role, kind, masked email, status |
| `accept_team_invite` | authenticated | Confirmed email must match; never changes existing membership; applies permissions + coordinators; co-owner uses ownership flag |

Legacy `create_wedding_invite` / `accept_wedding_invite` are thin wrappers so older tests keep working.

## 2. Application

- `src/features/team/services/*` invite wrappers + `pendingTeamInvite` (24h AsyncStorage)
- Hooks: preview, list, create, resend, revoke, accept
- `app/join/[token].tsx` → `JoinInviteScreen` (separate from guest `/invite/[token]`)
- Auth gate / login / register resume a pending join token after sign-in (planned auth-flow change from doc 07; mirrors keeping users on guest invite links)

Owner invite UI screens remain Milestone 8; services are ready for them.

## 3. Tests

| Suite | Result |
| --- | --- |
| `planning_team_invites.sql` | PASS |
| Existing foundation / membership / security suites | PASS (updated for template permissions on accept) |
| Auth redirect + pending invite unit tests | included in `npm test` |

## 4. Auth-flow note (rule 12)

`resolveAuthRedirect` now accepts `pendingJoinToken` and sends newly signed-in users to `/join/<token>` instead of `/(app)`. Login and register screens do the same after a successful session. Guest `/invite` behaviour is unchanged. This is the only auth navigation change in Milestone 4.
