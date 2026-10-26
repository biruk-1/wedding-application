# Database architecture

## Sources of truth

| Artifact | Role |
| --- | --- |
| `reference/kiburan_schema.sql` | Immutable PM schema. Never edit. |
| `supabase/migrations/20260325120000_pm_baseline.sql` | Version-controlled copy of the PM schema applied first. |
| Later `supabase/migrations/*` | Approved security, integrity, and operability layers. |
| `supabase/seed.sql` | Idempotent reference categories/templates. |
| `docs/schema-audit.md` | Findings and open PM questions. |

## Migration order

1. **`20260325120000_pm_baseline`** — 37 tables, FKs, checks, indexes from the PM file.
2. **`20260325120100_security_helpers_triggers`** — `private` helpers, profile trigger, `updated_at`, cross-wedding/cross-vendor guards, RLS helper indexes.
3. **`20260325120200_authorized_rpcs`** — `create_wedding`, `create_wedding_invite`, `accept_wedding_invite`, `set_wedding_member_role`.
4. **`20260325120300_rls_policies`** — RLS on all public tables, column revoke on invite token hashes.

## Intentional differences from the PM SQL alone

These are **additive** layers; table/column names from the PM schema are unchanged.

| Difference | Why |
| --- | --- |
| `private` schema helpers | Membership and vendor checks for RLS/RPCs |
| Auth profile trigger | `profiles` must exist for every `auth.users` row |
| `updated_at` triggers | PM columns never auto-updated |
| Task `completed_at` sync | Keep status and timestamp aligned |
| Cross-reference triggers | Reject cross-wedding / wrong-vendor links |
| Security-definer RPCs | Atomic wedding create + single-use invite accept |
| RLS + grants on hashes | Least privilege for API roles |
| Seed categories | Local/dev reference data only |

## Domains

- **Identity:** `profiles` ↔ `auth.users`
- **Wedding core:** weddings, members, invites, events
- **Tasks:** categories, templates, tasks, assignees, comments
- **Vendors:** marketplace listings + wedding-linked workflow
- **Budget / guests / invitations / seating / timeline / files**

## Privileged operations (not client table writes)

| Operation | RPC |
| --- | --- |
| Create wedding + owner + budget | `public.create_wedding` |
| Create collaborator invite (returns raw token once) | `public.create_wedding_invite` |
| Accept collaborator invite | `public.accept_wedding_invite` |
| Change member role | `public.set_wedding_member_role` |

Direct `insert` into `weddings` / `wedding_members` is denied by RLS for API roles.
