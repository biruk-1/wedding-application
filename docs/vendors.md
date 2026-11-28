# Vendor marketplace (Task 7)

Routes under `/(app)/weddings/[weddingId]/vendors`.

## Features

- Marketplace home with search, category chips, city, and starting-price filters
- Celebration-aware recommended categories and stable vendor ordering
- Vendor profile: overview, services, packages, gallery (https media only), schedule windows, published reviews
- Save / remove shortlist via `wedding_vendors` (`status = shortlisted`)
- Inquiry form via `vendor_inquiries` (message required; optional service + proposed budget)

No featured flag exists in the schema — featured rails are omitted. Availability is shown only as vendor-recorded windows, not as a booking guarantee. Phone/email are not highlighted in the customer UI (public columns remain governed by RLS).

## Celebration personalization

The marketplace maps each of the eight celebration kinds to preferred existing `vendor_categories.slug` values. Matching vendors are ranked on the client by the earliest matching preferred slug; the source order is preserved within equal ranks. This is recommendation ordering, not a popularity score.

Recommended chips apply the same category filter as the normal category controls. **All Vendors** remains available to clear that filter. There is no database event-category join and no new category taxonomy. If a configured preferred slug is absent from the fetched categories, it is ignored.

## Database

| Table | Usage |
| --- | --- |
| `vendor_categories` | Category chips |
| `vendors` | Public when `listing_status = published` and `verification_status = verified` |
| `vendor_category_memberships` | Category associations |
| `vendor_services` / `vendor_packages` | Browse pricing |
| `vendor_media` | Gallery when `storage_path` is an https URL |
| `vendor_availability` | Optional upcoming windows |
| `vendor_reviews` | Published reviews only |
| `wedding_vendors` | Shortlist (write: `can_write_wedding`) |
| `vendor_inquiries` | Contact vendor (insert: writer + `created_by = auth.uid()`) |

## Local seed

`supabase/seed.sql` adds demo published vendors after a `db:reset`. Images use public Unsplash URLs in `cover_url` / `vendor_media.storage_path`. No storage bucket policy was added.

## Deferred

- Vendor admin / listing management
- Chat
- Private storage bucket URL signing (no bucket configured yet)
- Invented ratings or popularity ranking
- Database-managed event-to-category recommendations

## Quotes, bookings & Chapa

Couple UI: Marketplace → **Quotes** / **Bookings & pay**. Accepting a sent quote creates a `vendor_bookings` row (30% deposit by default), a linked `budget_items` line, then Chapa hosted checkout for deposit/balance via Edge Functions (`chapa-initialize`, `chapa-verify`, `chapa-webhook`). Successful charges mirror into `expense_payments` with `payment_method = chapa`. Vendor payout split: Profile → **Chapa payouts** in the vendor app (`chapa-register-subaccount`).
