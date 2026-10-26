-- Baseline: PM-supplied Kiburan schema (reference/kiburan_schema.sql).
-- SHA-256 of source: B1D81E008878182E57580D96005D1C34FDA019ABF8F574BC85D772A049A2C594
-- Do not edit the original reference file. Approved changes live in later migrations.
-- Kiburan wedding planning + vendor marketplace
-- PostgreSQL 15+ / Supabase. Run on an empty public schema.
-- Users authenticate via Supabase auth.users.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '', phone text, avatar_url text,
  preferred_language text not null default 'en' check (preferred_language in ('en','am')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  title text not null, partner_one_name text not null, partner_two_name text not null,
  wedding_date date, city text, country_code char(2) not null default 'ET',
  timezone text not null default 'Africa/Addis_Ababa',
  style text, cover_image_url text,
  status text not null default 'planning' check (status in ('planning','completed','cancelled','archived')),
  currency_code char(3) not null default 'ETB',
  estimated_guest_count integer check (estimated_guest_count >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.wedding_members (
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','partner','planner','collaborator','viewer')),
  joined_at timestamptz not null default now(),
  primary key (wedding_id,user_id)
);

create table public.wedding_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  invited_email text, invited_phone text,
  role text not null default 'collaborator' check (role in ('partner','planner','collaborator','viewer')),
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null, accepted_by uuid references public.profiles(id),
  accepted_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (invited_email is not null or invited_phone is not null)
);

create table public.wedding_events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  event_type text not null default 'other',
  name text not null, starts_at timestamptz, ends_at timestamptz,
  venue_name text, address text, city text, notes text,
  sort_order int not null default 0,
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.task_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name_en text not null, name_am text,
  icon text, sort_order int not null default 0, is_active boolean not null default true
);

create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.task_categories(id),
  title_en text not null, title_am text, description_en text, description_am text,
  suggested_days_before integer, sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.wedding_tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  event_id uuid references public.wedding_events(id) on delete set null,
  category_id uuid references public.task_categories(id) on delete set null,
  template_id uuid references public.checklist_templates(id) on delete set null,
  parent_task_id uuid references public.wedding_tasks(id) on delete set null,
  title text not null, description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date, completed_at timestamptz,
  created_by uuid references public.profiles(id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.task_assignees (
  task_id uuid not null references public.wedding_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key(task_id,user_id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.wedding_tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null, created_at timestamptz not null default now()
);

create table public.vendor_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name_en text not null, name_am text
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id),
  business_name text not null, slug text not null unique,
  description text, phone text, email text, website_url text,
  instagram_url text, city text, country_code char(2) not null default 'ET',
  address text, logo_url text, cover_url text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','pending','verified','rejected')),
  listing_status text not null default 'draft' check (listing_status in ('draft','published','suspended')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.vendor_team_members (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','manager','staff')),
  primary key(vendor_id,user_id)
);

create table public.vendor_category_memberships (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid not null references public.vendor_categories(id) on delete cascade,
  primary key(vendor_id,category_id)
);

create table public.vendor_services (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  category_id uuid references public.vendor_categories(id) on delete set null,
  title text not null, description text,
  base_price numeric(14,2) check (base_price >= 0),
  currency_code char(3) not null default 'ETB',
  price_unit text not null default 'package' check (price_unit in ('package','hour','day','person','item','custom')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vendor_packages (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.vendor_services(id) on delete cascade,
  name text not null, description text, inclusions jsonb not null default '[]'::jsonb,
  price numeric(14,2) check (price >= 0),
  currency_code char(3) not null default 'ETB', is_active boolean not null default true
);

create table public.vendor_media (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  service_id uuid references public.vendor_services(id) on delete set null,
  storage_path text not null, media_type text not null default 'image' check (media_type in ('image','video')),
  caption text, sort_order int not null default 0
);

create table public.vendor_availability (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  service_id uuid references public.vendor_services(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null check (status in ('available','unavailable','tentative','booked')),
  notes text, check (ends_at > starts_at)
);

-- Wedding-linked vendor references support both marketplace vendors and outside suppliers.
create table public.wedding_vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  event_id uuid references public.wedding_events(id) on delete set null,
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.vendor_categories(id) on delete set null,
  external_business_name text, external_phone text,
  notes text,
  status text not null default 'shortlisted' check (status in ('shortlisted','contacted','negotiating','booked','completed','cancelled')),
  created_at timestamptz not null default now(),
  check (vendor_id is not null or external_business_name is not null)
);

create table public.vendor_inquiries (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id),
  service_id uuid references public.vendor_services(id),
  requested_event_id uuid references public.wedding_events(id) on delete set null,
  message text, proposed_budget numeric(14,2) check (proposed_budget >= 0),
  status text not null default 'new' check (status in ('new','replied','quoted','accepted','declined','closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.vendor_inquiries(id) on delete cascade,
  package_id uuid references public.vendor_packages(id),
  amount numeric(14,2) not null check (amount >= 0), currency_code char(3) not null default 'ETB',
  description text, valid_until date,
  status text not null default 'sent' check (status in ('draft','sent','accepted','rejected','expired')),
  created_at timestamptz not null default now()
);

create table public.vendor_bookings (
  id uuid primary key default gen_random_uuid(),
  wedding_vendor_id uuid not null references public.wedding_vendors(id) on delete cascade,
  quote_id uuid references public.vendor_quotes(id),
  booking_date date, start_at timestamptz, end_at timestamptz,
  total_amount numeric(14,2) check (total_amount >= 0),
  deposit_amount numeric(14,2) check (deposit_amount >= 0),
  currency_code char(3) not null default 'ETB',
  status text not null default 'pending' check (status in ('pending','confirmed','fulfilled','cancelled')),
  contract_storage_path text, notes text,
  created_at timestamptz not null default now(),
  check (end_at is null or start_at is null or end_at >= start_at),
  check (total_amount is null or deposit_amount is null or deposit_amount <= total_amount)
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique, name_en text not null, name_am text
);

create table public.wedding_budgets (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  total_budget numeric(14,2) not null default 0 check (total_budget >= 0),
  currency_code char(3) not null default 'ETB', updated_at timestamptz not null default now()
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  category_id uuid references public.budget_categories(id) on delete set null,
  wedding_vendor_id uuid references public.wedding_vendors(id) on delete set null,
  booking_id uuid references public.vendor_bookings(id) on delete set null,
  label text not null,
  estimated_amount numeric(14,2) not null default 0 check (estimated_amount >= 0),
  committed_amount numeric(14,2) check (committed_amount >= 0),
  notes text, created_at timestamptz not null default now()
);

create table public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references public.budget_items(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  payment_method text check (payment_method in ('cash','bank_transfer','telebirr','chapa','card','other')),
  reference text, receipt_storage_path text, notes text,
  recorded_by uuid references public.profiles(id)
);

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null, side text check (side in ('partner_one','partner_two','both','other')),
  notes text
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  full_name text not null, phone text, email text,
  side text check (side in ('partner_one','partner_two','both','other')),
  guest_type text check (guest_type in ('family','friend','coworker','other')),
  plus_one_allowed boolean not null default false,
  dietary_notes text, notes text,
  created_at timestamptz not null default now()
);

create table public.invitation_designs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null, design_data jsonb not null default '{}'::jsonb,
  storage_path text, created_at timestamptz not null default now()
);

-- An invitation can cover one or more events; group invites may cover a household.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  design_id uuid references public.invitation_designs(id) on delete set null,
  token_hash text not null unique,
  delivery_channel text check (delivery_channel in ('link','sms','whatsapp','email','print','other')),
  status text not null default 'draft' check (status in ('draft','ready','sent','delivered','opened','cancelled')),
  sent_at timestamptz, delivered_at timestamptz, opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (guest_id is not null or group_id is not null)
);

create table public.invitation_events (
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  event_id uuid not null references public.wedding_events(id) on delete cascade,
  primary key(invitation_id,event_id)
);

create table public.guest_rsvps (
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.wedding_events(id) on delete cascade,
  response text not null default 'pending' check (response in ('pending','yes','no','maybe')),
  responded_at timestamptz,
  attendance_checked_in_at timestamptz,
  primary key (guest_id,event_id)
);

create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events(id) on delete cascade,
  name text not null, capacity int check (capacity > 0),
  sort_order int not null default 0,
  unique(event_id,name)
);

create table public.seating_assignments (
  event_id uuid not null references public.wedding_events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  table_id uuid not null references public.seating_tables(id) on delete cascade,
  seat_number int check (seat_number > 0),
  primary key(event_id,guest_id),
  unique(table_id,seat_number)
);

create table public.timeline_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.wedding_events(id) on delete cascade,
  title text not null, starts_at timestamptz, ends_at timestamptz,
  assigned_to uuid references public.profiles(id), notes text,
  sort_order int not null default 0,
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.wedding_files (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  task_id uuid references public.wedding_tasks(id) on delete set null,
  booking_id uuid references public.vendor_bookings(id) on delete set null,
  display_name text not null, storage_path text not null,
  created_at timestamptz not null default now()
);

create table public.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  rating int not null check (rating between 1 and 5),
  comment text, status text not null default 'pending' check (status in ('pending','published','hidden')),
  created_at timestamptz not null default now(),
  unique(vendor_id,wedding_id)
);

-- Most common screens and access paths
create index idx_wedding_members_user on public.wedding_members(user_id);
create index idx_wedding_events_wedding on public.wedding_events(wedding_id,starts_at);
create index idx_wedding_tasks_board on public.wedding_tasks(wedding_id,status,due_date);
create index idx_wedding_tasks_category on public.wedding_tasks(wedding_id,category_id);
create index idx_task_assignees_user on public.task_assignees(user_id);
create index idx_vendor_search on public.vendors(city,listing_status,verification_status);
create index idx_vendor_services_vendor on public.vendor_services(vendor_id);
create index idx_vendor_availability on public.vendor_availability(vendor_id,starts_at,ends_at);
create index idx_wedding_vendors_wedding on public.wedding_vendors(wedding_id,status);
create index idx_vendor_inquiries_vendor on public.vendor_inquiries(vendor_id,status);
create index idx_budget_items_wedding on public.budget_items(wedding_id);
create index idx_expense_payments_item on public.expense_payments(budget_item_id);
create index idx_guests_wedding on public.guests(wedding_id,full_name);
create index idx_invitations_wedding_status on public.invitations(wedding_id,status);
create index idx_guest_rsvps_event on public.guest_rsvps(event_id,response);
create index idx_timeline_items_event on public.timeline_items(event_id,starts_at);

-- IMPORTANT DEPLOYMENT NOTE:
-- Tables are NOT yet exposed with RLS policies. Before using Supabase client-side,
-- enable RLS and implement policies verifying wedding membership, role capabilities,
-- vendor team membership, and public access to published vendor listings only.
-- Build database-side invariant checks (via triggers/RPCs) for cross-wedding references:
-- event/task/guest/group/invitation/booking/seat references must belong to their parent wedding;
-- quote.vendor must equal wedding_vendor.vendor; reviewer must be an eligible member;
-- only owners can change permissions, and guests must not see private wedding data.
-- Keep invitation token hashes and private contact data inaccessible to anonymous clients.
-- Use security-definer RPCs (with locked search_path and explicit authorization)
-- for atomic wedding creation + owner membership and for secure invitation acceptance.
