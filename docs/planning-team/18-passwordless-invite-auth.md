# Planning Team — 18. Passwordless invite authentication

Status: **plan + local implementation.** Migration applied to the local stack only. Nothing deployed.

## 1. Root cause of the password requirement

Invites only bind an **email** to a wedding. Acceptance requires a Supabase session whose verified email matches. The app only exposed **email + password** sign-up/sign-in, so invitees had to create or remember a password even though the invite itself never issued one.

There was no `signInWithOtp` / `verifyOtp` usage. Magic-link handling existed only for password-reset deep links.

## 2. Proposed / applied database change (additive)

File: `supabase/migrations/20261106160000_team_invite_email_validate.sql`

| RPC | Purpose |
| --- | --- |
| `validate_team_invite_email(raw_token, email)` | Anon + authenticated. Confirms token is pending and email matches the invite. Returns safe preview fields. Does **not** reveal whether the email already has a Kiburan account. Does **not** accept the invite. |

Acceptance remains `accept_team_invite` / `accept_my_team_invite` (backend email match, expiry, revoke, duplicate, co-owner cap).

## 3. Supabase Auth configuration

### Local (`supabase/config.toml`)

- Keep `enable_signup = true` so OTP can create users.
- OTP emails are delivered to **Mailpit**: http://127.0.0.1:54324
- `enable_confirmations` can stay `false` for normal password signup; OTP verification still proves email control for the invite path.
- Redirect URLs already include `kiburan://**` for optional magic-link fallback.

After changing `config.toml`, restart: `npm run db:stop` then `npm run db:start`.

### Hosted dashboard (manual, later)

1. Authentication → Providers → Email: enable Email OTP / magic link.
2. URL configuration: Site URL + redirect URLs for `kiburan://**` and production web origin.
3. Do **not** disable password login unless product explicitly decides to.

## 4. Client flow

`Invitation link → Join screen → Email → OTP → Accept invite → Wedding workspace`

Password login/register/reset remain for normal Kiburan use.

## 5. Files changed

| Area | Files |
| --- | --- |
| Migration | `supabase/migrations/20261106160000_team_invite_email_validate.sql` |
| Auth | `authService.ts` (`requestEmailOtp`, `verifyEmailOtp`), `authErrors.ts`, `AuthContext.tsx` |
| Team | `teamService.validateTeamInviteEmail`, `JoinInviteScreen` rewrite, `teamErrors.ts`, invite copy |
| Types | `database.types.ts` |
| Tests | `planning_team_invites.sql` validate cases |

## 6. How to test with two emails (local)

Prerequisites: `npm run db:start`, Expo running, Mailpit at http://127.0.0.1:54324

### A — New email (never registered)

1. Owner account A: Planning team → Invite → email `new.collab@test.com` → share/copy link.
2. Sign out. Open `kiburan://join/<token>` (or Expo join URL).
3. Continue → enter `new.collab@test.com` → Send verification code.
4. Open Mailpit → open the OTP email → copy 6-digit code.
5. Enter code → Verify & join → land in the wedding (no password).

### B — Existing Kiburan user

1. Register `existing@test.com` with a password (or use an old account).
2. Owner invites `existing@test.com`.
3. Sign out → open join link → passwordless OTP with that email (do not use password).
4. Or: stay signed in as `existing@test.com` → Join wedding on the invite screen.

### C — Negative cases

| Case | Expected |
| --- | --- |
| Wrong email on join | “sent to a different email address” before OTP |
| Bad OTP | Incorrect/expired code message |
| Resend | Countdown, then new Mailpit email |
| Revoked / expired invite | Unavailable screen |
| Accept twice | Already used / already a member |
| Other wedding | RLS denies |

### D — Password login still works

Normal Login / Register / Forgot password unchanged for non-invite use.

## 7. Hosted Supabase checklist (manual later)

1. Enable Email provider OTP / magic link.
2. Set redirect URLs for `kiburan://**`.
3. Apply migration `20261106160000_team_invite_email_validate.sql` when production apply is approved.
4. Keep password auth enabled.
