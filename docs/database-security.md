# Database security

Status: **provisional first version** for local development. Role capabilities below are conservative defaults pending PM answers to `docs/schema-audit.md` questions 1–4.

## Principles

- RLS enabled on every `public` table.
- API roles (`anon`, `authenticated`) never receive the service role key.
- Wedding data is membership-scoped.
- Vendor listings are public only when `listing_status = 'published'` **and** `verification_status = 'verified'` (per Task 2 product rule).
- Token hashes are not selectable by API roles.
- Privileged multi-step writes use `SECURITY DEFINER` RPCs with locked `search_path` and explicit `auth.uid()` checks.

## Provisional wedding roles

| Role | Read wedding | Write content | Manage members / invites |
| --- | --- | --- | --- |
| `viewer` | yes | no | no |
| `collaborator` | yes | yes | no |
| `planner` | yes | yes | no |
| `partner` | yes | yes | no |
| `owner` | yes | yes | yes (via RPC) |

“Write content” covers events, tasks, guests, budget items, wedding vendors, files, etc.

**Not decided (blocked for finer policies):** whether `partner` equals `owner`, whether planners can delete, multi-owner rules beyond “cannot remove last owner”.

## Vendor access

| Actor | Access |
| --- | --- |
| Anonymous / any authenticated | `SELECT` published+verified vendors and their active public children |
| Vendor owner / team | Full manage of that vendor (except `verification_status`) |
| Wedding writers | Create inquiries / shortlist; bookings per RLS |
| Vendor team | Read/respond to inquiries and quotes for their vendor |

`verification_status` changes are blocked for non-`service_role` until an admin model exists (audit Q2).

## RPCs

### `create_wedding(...)`

- Requires authenticated user.
- Extended by `20261103180000_celebration_onboarding.sql` for eight celebration kinds.
- Inserts the celebration (`created_by = auth.uid()`), owner membership, budget total, and initial allocation items in one transaction.
- Allows nullable partner columns for non-wedding celebrations, but validates that weddings have two nonblank partner names.
- Rejects invalid kinds, negative totals/counts/allocations, unknown budget category slugs, and allocations exceeding the total budget.
- Keeps the original argument order and defaulted new arguments for existing caller compatibility.
- Does **not** seed event-specific checklist templates.

### `create_wedding_invite(...)`

- Owner only.
- Stores SHA-256 hash; returns raw token once.

### `accept_wedding_invite(raw_token)`

- Authenticated.
- Rejects missing, revoked, already-used, or expired tokens.
- Upserts membership with invite role; marks invite accepted.
- **Gap:** does not require email/phone match (audit Q4).

### `set_wedding_member_role(...)`

- Owner only.
- Refuses removing the last owner.

## Anonymous denial

Anonymous policies allow only:

- Active lookup tables (categories/templates)
- Published+verified vendor marketplace reads
- Published vendor reviews

No wedding, guest, budget, invite, or private contact access for `anon`.

## Known gaps (do not treat as closed)

1. No platform admin / moderator role.
2. ~~Guest invitation public RSVP-by-token RPC not implemented.~~ Closed by `20260330120000_guest_invitation_rpcs.sql` (`create_guest_invitation`, `get_guest_invitation_by_token`, `submit_guest_invitation_rsvp`, `mark_guest_invitation_sent`). Residual gaps: no rate limiting or token expiry on the anon RPCs. Anon still has no table policies on guests/invitations — only those RPCs.
3. ~~Invite email/phone binding not enforced (collaborator invites).~~ Closed by `20261106090000_team_hardening.sql` once applied: invites are email-only, normalized, unique while pending, live 1 hour to 30 days, and can only be accepted by the confirmed account with that email. Phone invites wait for phone sign-in.
4. Soft-delete / account deletion policy unresolved (audit Q3).
5. Storage bucket policies not defined (paths only).
6. ~~Column revokes on `invitations.token_hash` and `wedding_invites.token_hash` are ineffective.~~ The original column revokes did not override table-level grants, so hashes were readable and writable by `authenticated`. Closed by `20261106090000_team_hardening.sql` once applied: table grants are replaced by column grants without `token_hash`, and both tables accept inserts only through their RPCs.

## Security tests

See `supabase/tests/security_foundation.sql`, `supabase/tests/planning_team_security.sql` and `npm run db:test:security` (runs both; requires the `20261106*_team_*` migrations).

**Current evidence:** the security SQL suite passed, including the celebration-onboarding RPC coverage. The broader verification also passed typecheck, 34 files / 207 tests, and Expo Doctor 20/20; lint had 0 errors and the known generated-file warning.
