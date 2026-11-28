-- Platform admin model for kiburan-admin (Next.js).
-- Privileged writes still go through the service-role client on the server.
-- Mobile apps never gain new write rights via this migration.

-- ---------------------------------------------------------------------------
-- 1. Platform admins (no client policies — service_role only)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('super_admin', 'admin', 'support')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.platform_admins is
  'Users allowed to access kiburan-admin. Checked server-side before service-role use.';

alter table public.platform_admins enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Admin audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_entity_idx
  on public.admin_audit_log (entity_type, entity_id);

create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log (admin_id, created_at desc);

comment on table public.admin_audit_log is
  'Immutable trail of every kiburan-admin mutation.';

alter table public.admin_audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Vendor moderation columns
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists rejection_reason text,
  add column if not exists suspended_reason text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

comment on column public.vendors.rejection_reason is
  'Set by platform admin when verification_status becomes rejected.';
comment on column public.vendors.suspended_reason is
  'Set by platform admin when listing_status becomes suspended.';
comment on column public.vendors.verified_at is
  'When platform admin set verification_status to verified.';
comment on column public.vendors.verified_by is
  'Platform admin user_id who verified this vendor.';

-- ---------------------------------------------------------------------------
-- 4. Profile ban flag (Auth ban_duration still applied via Admin API)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_banned boolean not null default false;

comment on column public.profiles.is_banned is
  'Mirror of Auth ban. Set by kiburan-admin when banning a user.';

-- ---------------------------------------------------------------------------
-- 5. Grants — service_role only (no authenticated / anon grants)
-- ---------------------------------------------------------------------------
grant all on table public.platform_admins to service_role;
grant all on table public.admin_audit_log to service_role;

-- ---------------------------------------------------------------------------
-- 6. Overview helpers (readable via service_role in admin app)
-- ---------------------------------------------------------------------------
create or replace view public.admin_vendor_overview as
select
  v.id,
  v.business_name,
  v.slug,
  v.city,
  v.email,
  v.phone,
  v.verification_status,
  v.listing_status,
  v.rejection_reason,
  v.suspended_reason,
  v.verified_at,
  v.verified_by,
  v.owner_user_id,
  v.created_at,
  v.updated_at,
  p.display_name as owner_display_name,
  (
    select count(*)::int
    from public.vendor_services s
    where s.vendor_id = v.id and s.is_active
  ) as active_service_count,
  (
    select count(*)::int
    from public.vendor_inquiries i
    where i.vendor_id = v.id
  ) as inquiry_count,
  (
    select count(*)::int
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where wv.vendor_id = v.id
  ) as booking_count
from public.vendors v
left join public.profiles p on p.id = v.owner_user_id;

comment on view public.admin_vendor_overview is
  'Admin list/detail helper for vendors with owner + counts.';

grant select on public.admin_vendor_overview to service_role;

create or replace view public.admin_wedding_overview as
select
  w.id,
  w.title,
  w.partner_one_name,
  w.partner_two_name,
  w.wedding_date,
  w.city,
  w.status,
  w.currency_code,
  w.created_by,
  w.created_at,
  w.updated_at,
  p.display_name as owner_display_name,
  (
    select count(*)::int
    from public.wedding_members m
    where m.wedding_id = w.id
  ) as member_count,
  (
    select count(*)::int
    from public.guests g
    where g.wedding_id = w.id
  ) as guest_count,
  (
    select count(*)::int
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where wv.wedding_id = w.id
  ) as booking_count
from public.weddings w
left join public.profiles p on p.id = w.created_by;

comment on view public.admin_wedding_overview is
  'Admin list/detail helper for weddings with owner + counts.';

grant select on public.admin_wedding_overview to service_role;
