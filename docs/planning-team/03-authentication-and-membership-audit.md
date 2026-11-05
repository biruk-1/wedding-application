# Planning Team — 03. Authentication and membership audit

## 1. Authentication today

| Step | Implementation | Verdict |
| --- | --- | --- |
| Sign-up | `supabase.auth.signUp` with email + password and `display_name` metadata (`authService.ts#signUp`) | Works. Email only, no phone/OTP. |
| Profile creation | `private.handle_new_user()` trigger on `auth.users` insert (`SECURITY DEFINER`, `search_path=''`), idempotent (`on conflict do nothing`). `create_wedding` and `accept_wedding_invite` also upsert a bare profile as a fallback. | Correct. |
| Sign-in | `signInWithPassword`; PKCE flow; session persisted via `authStorage` | Correct. |
| Deep links | `AuthContext` consumes `code` (PKCE) or `#access_token` links for recovery / confirmation | Correct. |
| Routing | `resolveAuthRedirect` sends signed-in users away from public pages to `/(app)`; leaves `invite/*` and `reset-password` alone | No "return-to" support (needed for team invites). |
| Cache isolation | `syncCacheOwner` clears all queries when the user changes; all query keys are prefixed with the user id | Good basis for multi-account devices. |
| Email confirmation | Disabled locally (`enable_confirmations = false`); production setting unknown | **Matters for invite binding**: an unconfirmed email cannot be trusted to prove ownership of an invited address. |

The Planning Team feature does not require changing the authentication flow itself. It requires (a) a pending-invite "return-to" after sign-in/sign-up and (b) a decision on email confirmation in production. Both are listed as decisions in `08-implementation-roadmap.md`.

## 2. How the wedding creator becomes a member

`public.create_wedding(...)` (current version from `20261103180000_celebration_onboarding.sql`), `SECURITY DEFINER`, `search_path = ''`, in one transaction:

1. Rejects a null `auth.uid()`; validates title, celebration kind, partner names (weddings only), budget and allocations.
2. Upserts the caller's profile.
3. Inserts `weddings` with `created_by = auth.uid()` (never from the client).
4. Inserts `wedding_members (wedding_id, auth.uid(), 'owner')`.
5. Inserts `wedding_budgets` and the initial allocation `budget_items`.

Clients cannot insert `weddings` or `wedding_members` directly (no INSERT policy), which the SQL test suite verifies. **Creation is atomic and correct.** Local data confirms it: every one of the 155 weddings has exactly one owner and the creator is always a member.

## 3. How ownership is represented

- Ownership = a `wedding_members` row with `role = 'owner'`.
- `weddings.created_by` records the creator but is **not** used by any policy or helper for authorization. It is, however, updatable by any writer (`weddings_update_writer` has no column restriction), so it cannot be trusted as an audit field either.
- `private.is_wedding_owner(w)` = "caller has an `owner` row". Owner-only operations today: reading/updating `wedding_invites`, `create_wedding_invite`, `set_wedding_member_role`, deleting other people's task comments.

## 4. Are multiple owners supported?

**Structurally yes, operationally no.**

- Nothing in the schema limits owners to one (or to two). The PK `(wedding_id, user_id)` only prevents duplicate rows for the same person.
- `wedding_invites.role` cannot be `owner` (check constraint), so the invite path can never produce a second owner.
- The only path to a second owner is `set_wedding_member_role(w, user, 'owner')`, which an existing owner can call on any member, unilaterally, with no consent from that member and no upper limit.
- All helpers (`is_wedding_owner`, `can_write_wedding`) already work with any number of owner rows, and the app's `useWeddingRole` only looks at the caller's own row. So two `owner` rows would *function* today.

Why "just insert two `owner` rows" is not safe:

| Problem | Where |
| --- | --- |
| Owner A can demote owner B (to any role) without B's consent, as long as A remains. Violates "an owner cannot silently remove or downgrade the other owner". | `set_wedding_member_role` only guards against removing the **last** owner. |
| Owner A can promote any collaborator to owner unilaterally, and there is no cap (3, 4, … owners). Violates "collaborators cannot automatically become owners" and the two-owner model. | `set_wedding_member_role` accepts `'owner'` for any member. |
| An owner who accepts any invite to their own wedding is **downgraded** to the invite's role. If they are the only owner, the wedding is left with **zero owners** permanently (no path can create an owner again). | `accept_wedding_invite` does `on conflict (wedding_id, user_id) do update set role = excluded.role` and has no last-owner check. |
| Nothing stops two concurrent role changes from each seeing "another owner remains" and both demoting, leaving zero owners. | `set_wedding_member_role` counts owners without locking the wedding or the member rows. |
| No way to remove a member or to leave a wedding at all. | No DELETE policy and no RPC on `wedding_members`. |

## 5. The existing `partner` role

- Allowed in `wedding_members.role` and `wedding_invites.role`.
- Behaviour: identical to `planner` and `collaborator` — counted by `can_write_wedding`, **not** counted by `is_wedding_owner`. A `partner` cannot invite, manage roles, or see `wedding_invites`.
- `docs/database-security.md` lists "whether `partner` equals `owner`" as undecided.
- Local data: 0 rows use it. Production usage unknown.

Conclusion: `partner` is **not** an equal owner today. It is a write-capable collaborator with a name that suggests otherwise. The proposal (doc 06) is to represent the second spouse as a second `owner`, keep `partner` valid for backward compatibility, and stop issuing it for new invites.

## 6. Membership operations

| Question | Answer |
| --- | --- |
| Unique per user and wedding? | Yes, PK `(wedding_id, user_id)`. |
| Member removal supported? | **No.** No DELETE policy, no RPC. Only a database admin can remove access. Blocking for revocation (Milestone 5). |
| Leave a wedding? | **No.** |
| Role change supported? | Yes, owners only, via `set_wedding_member_role`. |
| Membership writes atomic? | Creation: yes. Invite acceptance: yes (one function, `for update` on the invite row). Role change: single statement but the last-owner check is not concurrency-safe. Task assignment and group/guest deletion in the client are multi-request and not atomic. |
| Ownership protected from unauthorized changes? | Protected from non-owners (verified by test). **Not** protected from the other owner (see section 4). |
| Multiple weddings per user? | Yes. `listMyWeddings` returns all memberships; `WeddingSelectorScreen` lists them; the URL's `weddingId` selects the workspace. |
| Cleanup on membership end? | None exists. Removal would leave `task_assignees`, `timeline_items.assigned_to`, and (future) coordinator/permission rows behind unless handled. |

## 7. Invitation management audit (`wedding_invites`)

| Question | Finding |
| --- | --- |
| How created | `create_wedding_invite(wedding, role, email, phone, expires_in)`: owner-only, requires email or phone, role in `partner/planner/collaborator/viewer`, generates 32 random bytes (`gen_random_bytes`), stores the SHA-256 hex hash, returns the raw token once. |
| Recipient identification | Free-text `invited_email` / `invited_phone`. No normalisation (case, whitespace, E.164). |
| Token validation | `accept_wedding_invite(raw)` hashes the raw token and looks up `token_hash` with `for update`. 256-bit tokens make guessing infeasible. |
| Expiry | Yes, `expires_at` checked (`<= now()` rejected). Default 7 days. `p_expires_in` is caller-controlled with **no bounds** (a negative or multi-year interval is accepted). |
| Revocation | Column exists and acceptance honours it, but there is **no revoke RPC**. Owners can only revoke by a direct `UPDATE ... set revoked_at` (allowed by `wedding_invites_update_owner`, which is not column-restricted). No `revoked_by`. |
| Duplicate invitations | **Possible.** No uniqueness on `(wedding_id, invited_email)` for pending invites, and the RPC does not check. Inviting someone who is already a member is also allowed. |
| Accepting someone else's invite | **Possible.** Anyone holding the link can accept; the caller's email/phone is never compared with the invite (documented as audit Q4). A forwarded link grants access to whoever opens it. |
| Atomic membership creation | Yes — one function; invite row locked; membership upsert and `accepted_at` update in the same transaction. |
| Can it grant unauthorized roles? | It cannot grant `owner` directly (check constraint). But the upsert can **change an existing member's role**, both downgrade (including an owner, see section 4) and upgrade (a `viewer` accepting a `collaborator` invite). |
| Status model | Derived from three nullable timestamps; no explicit `status`; `accepted_by`/`accepted_at` consistency not enforced. |
| Client integration | None. No screen, service, or route uses team invites. `app/invite/[token].tsx` is the **guest RSVP** page and must stay separate. |

### Secure changes required for owner-only collaborator invitations

1. Keep creation owner-only (already true) and make it explicit that collaborators can never call it (no permission can grant `team.invite`).
2. Bind the invite to the recipient: accept only when the caller's **confirmed** auth email (case-insensitive) equals `invited_email`. Phone binding only if phone auth is introduced.
3. Never modify an existing membership on acceptance. If the caller is already a member, mark the invite as accepted-noop (or reject) and keep their current role.
4. Prevent duplicates: one pending invite per `(wedding_id, normalised email)`; reject invites to existing members.
5. Bound `expires_in` (e.g. 1 hour to 30 days).
6. Add an owner-only `revoke_team_invite` RPC that records `revoked_by`; remove the direct UPDATE policy.
7. Carry the intended permission set and guest-group assignments on the invite so membership, permissions and coordinator rows are created in the same transaction as acceptance.
8. Separate the co-owner invite (explicit kind, only while the wedding has fewer than two owners) from collaborator invites.

## 8. Safest way to support two equal owners without breaking existing weddings

Detailed design is in `06-proposed-database-architecture.md`. Summary:

1. **Representation:** both spouses hold `wedding_members.role = 'owner'`. No new "co-owner" role, no reliance on `weddings.created_by`. Every existing helper and every existing wedding (one owner row each) keeps working unchanged.
2. **Invariants enforced in the database**, not the app: at least 1 and at most 2 owners per wedding, checked in a trigger that locks the parent `weddings` row (`select … for update`) so concurrent changes serialize.
3. **Owner set changes only through dedicated RPCs:**
   - `invite_co_owner` — owner-only, only when the wedding has exactly one owner; the second owner joins only by accepting with their own account (that acceptance is the explicit confirmation).
   - `set_wedding_member_role` is hardened so it can never target an owner or assign `owner`.
   - Removing/downgrading the other owner or transferring ownership requires a two-party request/confirm workflow (`ownership_change_requests`), designed now and implemented later.
   - An owner may step down or leave only if another owner remains.
4. **Acceptance never downgrades:** `accept_wedding_invite` is replaced so it cannot touch existing memberships.
5. **Migration safety:** the new trigger is added after an assertion query proves no wedding currently has 0 or more than 2 owners (true locally: all have exactly 1). No existing row is rewritten.
