-- Public Explore: hide private vendor columns from signed-out (anon) clients.
-- RLS already limits anon to published + verified vendors and published reviews; it is row-level only,
-- so table-level SELECT exposed phone / email / address / owner and internal notes.
-- Grants only: no table, column, or policy changes. `authenticated` is unchanged.

revoke select on public.vendors from anon;
grant select (
  id,
  business_name,
  slug,
  description,
  website_url,
  instagram_url,
  city,
  country_code,
  logo_url,
  cover_url,
  verification_status,
  listing_status,
  created_at,
  updated_at
) on public.vendors to anon;

revoke select on public.vendor_availability from anon;
grant select (
  id,
  vendor_id,
  service_id,
  starts_at,
  ends_at,
  status
) on public.vendor_availability to anon;

revoke select on public.vendor_reviews from anon;
grant select (
  id,
  vendor_id,
  rating,
  comment,
  status,
  created_at
) on public.vendor_reviews to anon;
