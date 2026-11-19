# Planning Team — 17. Finish polish: invite inbox + dashboard

Status: **implemented locally.** Migration applied to the local stack only. Nothing deployed.

Closes remaining doc 07 app-integration gaps after Milestones 8–9 (no universal links / production apply).

## 1. Database

`supabase/migrations/20261106150000_team_my_pending_invites.sql`

| RPC | Who | Notes |
| --- | --- | --- |
| `list_my_pending_team_invites()` | authenticated | Pending, non-expired, non-revoked invites whose email matches the caller; excludes weddings they already joined |
| `accept_my_team_invite(invite_id)` | authenticated | Same rules as token accept (email match, confirmed email, co-owner cap); no raw deep-link token required |

Share-link accept (`accept_team_invite`) is unchanged.

## 2. Application

- **Dashboard** — Planning **Team** shortcut for `team.view` / owners; Budget / Guests / Tasks / Invitations / Schedule tiles gated by matching permissions (coordinators still see Guests via coordinated groups).
- **Wedding selector** — **Pending team invites** inbox at the top; Join calls `accept_my_team_invite`.
- **Invite member** — Clearer copy: app does not send email; share sheet + selectable link; mention inbox path for users who already have an account.

## 3. Checks

| Check | Result |
| --- | --- |
| `planning_team_invites.sql` (inbox cases) | PASS (via `db:test:security`) |
| Other SQL suites | PASS |
| `npm run typecheck` | PASS |
| Team Vitest | PASS |

## 4. Still deferred (needs explicit go-ahead)

- HTTPS universal / App Links + web install landing
- Automated invite email (Resend / provider)
- Production apply of M2–M7 (+ this) migrations
