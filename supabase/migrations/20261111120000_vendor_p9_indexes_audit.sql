-- Milestone 6 prerequisite (P9): vendor-side access indexes + nullable updated_at audit columns.
-- Additive only. No overlap guard on availability (documented gap).

-- ---------------------------------------------------------------------------
-- 1. Indexes for vendor-side query paths
-- ---------------------------------------------------------------------------
create index if not exists idx_wedding_vendors_vendor
  on public.wedding_vendors (vendor_id);

create index if not exists idx_vendor_bookings_wedding_vendor
  on public.vendor_bookings (wedding_vendor_id);

create index if not exists idx_vendor_quotes_inquiry
  on public.vendor_quotes (inquiry_id);

create index if not exists idx_vendor_media_vendor_sort
  on public.vendor_media (vendor_id, sort_order);

create index if not exists idx_vendor_packages_service
  on public.vendor_packages (service_id);

create index if not exists idx_vendor_inquiries_vendor_created
  on public.vendor_inquiries (vendor_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Audit columns (nullable so existing rows stay valid without backfill)
-- ---------------------------------------------------------------------------
alter table public.vendor_services
  add column if not exists updated_at timestamptz;

alter table public.vendor_inquiries
  add column if not exists updated_at timestamptz;

alter table public.vendor_quotes
  add column if not exists updated_at timestamptz;

alter table public.vendor_bookings
  add column if not exists updated_at timestamptz;

drop trigger if exists vendor_services_set_updated_at on public.vendor_services;
create trigger vendor_services_set_updated_at
  before update on public.vendor_services
  for each row execute function private.set_updated_at();

drop trigger if exists vendor_inquiries_set_updated_at on public.vendor_inquiries;
create trigger vendor_inquiries_set_updated_at
  before update on public.vendor_inquiries
  for each row execute function private.set_updated_at();

drop trigger if exists vendor_quotes_set_updated_at on public.vendor_quotes;
create trigger vendor_quotes_set_updated_at
  before update on public.vendor_quotes
  for each row execute function private.set_updated_at();

drop trigger if exists vendor_bookings_set_updated_at on public.vendor_bookings;
create trigger vendor_bookings_set_updated_at
  before update on public.vendor_bookings
  for each row execute function private.set_updated_at();
