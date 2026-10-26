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
- Inserts wedding (`created_by = auth.uid()`), owner membership, and empty `wedding_budgets` in one transaction.
- Does **not** yet seed checklist tasks (optional; pending product confirmation).

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
2. Guest invitation public RSVP-by-token RPC not implemented.
3. Invite email/phone binding not enforced.
4. Soft-delete / account deletion policy unresolved (audit Q3).
5. Storage bucket policies not defined (paths only).
6. Column revoke on `invitations.token_hash` still allows writers to set hashes (guest invite RPC preferred later).

## Security tests

See `supabase/tests/security_foundation.sql` and `npm run db:test:security`.

**Executed locally (2026-10-25):** `supabase/tests/security_foundation.sql` completed with `NOTICE: PASS: security_foundation checks completed` against `postgresql://postgres@127.0.0.1:54322` after `npm run db:reset`.
