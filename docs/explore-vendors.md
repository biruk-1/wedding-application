# Public Explore Vendors

Status: implemented locally. Grants migration applied to the local stack only.

## 1. Audit (before implementation)

### Navigation and auth

| Item | Finding |
| --- | --- |
| `app/index.tsx` | Rendered a loading screen; `useAuthGate` replaced signed-out users to `/login`. The approved photo `WelcomeScreen` was no longer reachable. |
| `resolveAuthRedirect` | Single policy for session-based redirects. Signed-out on `(app)` / `(tabs)` / `index` → `/login`. Signed-in on `login` / `register` / `forgot-password` / `index` → `/(app)` (or `/join/<token>`). |
| `AppHomeHubScreen` | Single place that decides dashboard vs create vs selector for signed-in users. |
| Sign-out | Every sign-out button replaces to `/login`. |
| Pending actions | Only the Planning Team invite token is preserved across sign-in (`pendingTeamInvite`). |

### Marketplace (all inside `/(app)/weddings/[weddingId]/vendors`)

| Piece | Reusable for Explore |
| --- | --- |
| `vendorService.listVendorCategories` | Yes |
| `vendorService.listPublishedVendors` | Partly — unbounded, `select('*')`, client-side filters |
| `vendorService.getVendorProfile` | Yes after column changes |
| `VendorCard`, `VendorFilterBar`, `SearchField`, `MarketplaceSkeleton`, `VendorProfileSkeleton`, `EmptyState` | Yes |
| `VendorProfileScreen` | Body reusable; screen itself is wedding-scoped (save / inquiry) |
| `InquiryScreen`, `saveVendorToWedding` | Yes — authenticated actions after sign-in |
| React Query hooks in `vendors/queries.ts` | Keys are user-scoped and disabled when signed out |

### Database (shared with `kiburan-vendor`)

Tables: `vendors`, `vendor_categories`, `vendor_category_memberships`, `vendor_services`, `vendor_packages`, `vendor_media`, `vendor_availability`, `vendor_reviews`.

Public visibility rule (already enforced by RLS for `anon`):
`vendors.listing_status = 'published' AND vendors.verification_status = 'verified'`, active services and packages of such vendors, their media / availability, and reviews with `status = 'published'`.

Not in the schema (so not shown): featured flag, popularity metric, event-type tagging on vendors, booking requests from couples, direct messages. Inquiries are the only couple → vendor message.

### Security gap found

RLS is row-level only. The `anon` role had table-level `SELECT` on `vendors`, `vendor_availability` and `vendor_reviews`, so anyone with the public anon key could read, for every published vendor:

- `vendors.phone`, `vendors.email`, `vendors.address`, `vendors.owner_user_id`
- `vendor_availability.notes` (vendor-internal notes)
- `vendor_reviews.wedding_id`, `vendor_reviews.reviewer_id`

## 2. Changes

### Migration `20261108160000_public_vendor_column_grants.sql`

Grants only — no tables, columns, or policies change. For the `anon` role:

- `vendors`: revoke table `SELECT`; grant `SELECT` on public columns only (no `phone`, `email`, `address`, `owner_user_id`).
- `vendor_availability`: same, without `notes`.
- `vendor_reviews`: same, without `wedding_id`, `reviewer_id`.

`authenticated` is unchanged, so the vendor app and signed-in couples keep their current reads. Shared client queries use explicit column lists so they work for both roles.

### Client

- `/` shows the photo welcome screen to signed-out users with Explore Vendors, Start Planning, Sign In. Signed-in users never stay on `/`; sign-out still goes to `/login`.
- `/explore` and `/explore/vendors/[vendorId]` are public routes.
- Explore uses server-side paging, search, and filters (`searchPublicVendors`, `listPublicServices`) with public query keys.
- Guest actions (Send inquiry, Save to my plan, Ask about this service) store a pending intent, go to sign-in, and resume through `/(app)/vendor-action` after authentication (creating a celebration first when the user has none).

### Shared reads

`services/vendorQueries.ts` is the single implementation for marketplace reads, used by:

- the signed-in marketplace (`vendorService.listPublishedVendors`, now bounded to 200 rows)
- the vendor profile (`vendorService.getVendorProfile`)
- Explore hooks (`usePublic*` in `queries.ts`)
- integration tests

Profiles only resolve for published and verified vendors. Reviewer names are no longer loaded.

### Resume rules (`resolveVendorActionStep`)

| Situation | Result |
| --- | --- |
| No celebration | Create one; the "celebration created" screen offers "Continue with <vendor>" |
| No celebration but pending team invites | Choose between creating a celebration and reviewing invites |
| One celebration | Run immediately |
| Several celebrations | Pick one |
| View-only access | Explain; nothing is written |

The stored action is cleared before it runs. Saving is idempotent. Inquiries still need the user to press Send.

### Not shown (no backend)

Featured badges, popularity ranking, rating or availability filters, event-type filters, booking, and messaging.

### Tests

- Unit: `resolveAuthRedirect`, `resolveAppHomeDestination`, `resolveVendorActionStep`, `pendingVendorAction`, `vendorQueries` helpers, public query keys.
- Integration (local Supabase, anon client): `publicExplore.integration.test.ts`.
