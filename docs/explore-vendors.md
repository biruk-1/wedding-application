# Public Explore Vendors

Status: redesigned on `feature/explore-vendors-redesign`. Checkpoint before redesign: `checkpoint/pre-explore-vendors-redesign` (`bcbcde3`). Grants migration applied to the local stack only.

## 1. Audit (before implementation)

### Navigation and auth

| Item | Finding |
| --- | --- |
| `app/index.tsx` | Photo `WelcomeScreen` for signed-out users; `useAuthGate` sends signed-in users to `/(app)`. |
| `resolveAuthRedirect` | Public Explore (`explore-vendors`) is open to everyone. Signed-out on `(app)` → `/login`. |
| Pending actions | Team invite token + Explore vendor action (`pendingVendorAction`) survive sign-in. |

### Marketplace reuse

`VendorCard`, categories, `SearchField`, skeletons, `vendorQueries` shared reads, inquiry / save flows.

### Database

Public visibility (RLS for `anon`): published + verified vendors; active services/packages; media; published reviews.

### Security gap (addressed by grants migration)

RLS is row-level only. Migration `20261108160000_public_vendor_column_grants.sql` revokes table `SELECT` for `anon` on sensitive columns (`phone`, `email`, `address`, `owner_user_id`, availability `notes`, review `wedding_id` / `reviewer_id`).

**Remaining ops note:** migration must be applied on every environment (local done; staging/production need a reviewed deploy). Do not ship a service-role key in the mobile app.

### Reviewed security gaps (do not silently change RLS)

Row RLS is sufficient for published+verified browse. Open items for a future reviewed migration:

| Gap | Severity | Detail |
| --- | --- | --- |
| Authenticated column privileges | Medium | Signed-in clients can still `SELECT` `phone` / `email` / `address` / `owner_user_id` on published vendors; availability `notes`; review `wedding_id` / `reviewer_id`. Anon grants were tightened; `authenticated` was intentionally unchanged. |
| `vendor-public` storage SELECT | Medium | Bucket policy allows public reads by path without checking `is_public_vendor` — draft assets under a known `{vendor_id}/…` path could be downloadable. |
| Published reviews after unpublish | Low–Med | `vendor_reviews_select` checks `status = 'published'` only, not vendor public state. |
| Hosted deploy drift | High if lagging | Confirm `20261108160000` is applied on staging/production before shipping Explore. |

Proposed reviewed follow-ups (document only until product signs off): mirror anon column grants for non-team authenticated reads (or expose contact via security-definer RPC after inquiry); optionally require `private.is_public_vendor(vendor_id)` on published reviews; optionally gate `vendor-public` storage to public vendors; add SQL tests for the matrix.

## 2. Redesign (this branch)

### Explore screen (`ExploreVendorsScreen`)

- Compact header: Kiburan brand left, Sign in / My plans right (no in-app floating settings; Expo Go gear is the host debug menu).
- Intro: “Explore vendors” + “Discover trusted vendors… Browse freely — no account needed.”
- Search with clear control; categories remain horizontal chips.
- Location + price moved into `VendorFiltersSheet` (Apply / Reset + active count on Filters).
- Vendor-first results with count + A–Z / Newest sort; services kept as a secondary horizontal rail.
- Responsive: single-column rows on phones; two-column grid on wider layouts (≥520).

### Cards and public profile

- Vendor name is primary; Verified badge (public listings are RLS-gated to verified).
- Category, location, real service titles, starting price, and ratings only when data exists.
- Public profile unchanged in route; shared `VendorProfileDetails` shows Verified, services, packages, gallery.

### Guest → auth flow

1. Guest browses `/explore-vendors` and `/explore-vendors/[vendorId]` without auth.
2. Save / inquire stores `pendingVendorAction`, opens login/register with an explanation.
3. After auth, `AppHomeHubScreen` → `/(app)/vendor-action` resumes once (cleared before run; save is idempotent).

## 3. Tests

- Unit: `resolveAuthRedirect`, `resolveAppHomeDestination`, `resolveVendorActionStep`, `pendingVendorAction`, `vendorQueries` helpers (incl. `serviceTitles`), public query keys.
- Integration (local Supabase, anon client): `publicExplore.integration.test.ts`.
