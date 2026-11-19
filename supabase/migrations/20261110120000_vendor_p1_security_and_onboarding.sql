-- Vendor P1 security hardening + create/submit RPCs (Milestone 4 prerequisite).
-- Additive: extends an existing trigger, replaces policies with narrower ones, adds RPCs.
-- Client-visible behavior change: closes S1–S6 write holes; vendors can no longer
-- directly UPDATE wedding_vendors / vendor_inquiries / vendor_bookings (those waits for P3 RPCs).
-- Seed / service_role still may set verification and listing freely.

-- ---------------------------------------------------------------------------
-- 1. Force unverified/draft on client inserts; keep verification change guard
-- ---------------------------------------------------------------------------
create or replace function private.protect_vendor_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
  v_is_privileged boolean :=
    v_jwt_role = 'service_role'
    or v_db_user in ('postgres', 'supabase_admin');
begin
  if tg_op = 'INSERT' and not v_is_privileged then
    new.verification_status := 'unverified';
    new.listing_status := 'draft';
  end if;

  if tg_op = 'UPDATE' and not v_is_privileged then
    if new.verification_status is distinct from old.verification_status then
      raise exception 'verification_status can only be changed by service role until an admin model exists';
    end if;
    if old.listing_status = 'suspended' and new.listing_status is distinct from old.listing_status then
      raise exception 'listing_status cannot leave suspended without service role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vendors_protect_verification on public.vendors;
create trigger vendors_protect_verification
  before insert or update of verification_status, listing_status on public.vendors
  for each row execute function private.protect_vendor_verification();

-- ---------------------------------------------------------------------------
-- 2. Owner / team protections
-- ---------------------------------------------------------------------------
create or replace function private.protect_vendor_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
begin
  if tg_op = 'UPDATE'
     and new.owner_user_id is distinct from old.owner_user_id
     and v_jwt_role is distinct from 'service_role'
     and v_db_user not in ('postgres', 'supabase_admin')
     and auth.uid() is distinct from old.owner_user_id then
    raise exception 'only the current owner can transfer ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_protect_owner on public.vendors;
create trigger vendors_protect_owner
  before update of owner_user_id on public.vendors
  for each row execute function private.protect_vendor_owner();

create or replace function private.protect_vendor_team_owner_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
  v_is_privileged boolean :=
    v_jwt_role = 'service_role'
    or v_db_user in ('postgres', 'supabase_admin');
  v_actor_is_owner boolean;
begin
  if v_is_privileged then
    return coalesce(new, old);
  end if;

  select exists (
    select 1
    from public.vendors v
    where v.id = coalesce(new.vendor_id, old.vendor_id)
      and v.owner_user_id = auth.uid()
  ) into v_actor_is_owner;

  if tg_op = 'INSERT' and new.role = 'owner' and not v_actor_is_owner then
    raise exception 'only the business owner can add an owner team member';
  end if;

  if tg_op = 'UPDATE' then
    if (old.role = 'owner' or new.role = 'owner') and not v_actor_is_owner then
      raise exception 'only the business owner can change the owner team role';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' and not v_actor_is_owner then
    raise exception 'only the business owner can remove the owner team member';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists vendor_team_protect_owner_role on public.vendor_team_members;
create trigger vendor_team_protect_owner_role
  before insert or update or delete on public.vendor_team_members
  for each row execute function private.protect_vendor_team_owner_role();

-- ---------------------------------------------------------------------------
-- 3. Booking status transitions (S4 partial: even with write access, illegal jumps fail)
-- ---------------------------------------------------------------------------
create or replace function private.protect_vendor_booking_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
begin
  if tg_op = 'UPDATE'
     and new.status is distinct from old.status
     and v_jwt_role is distinct from 'service_role'
     and v_db_user not in ('postgres', 'supabase_admin') then
    if old.status in ('fulfilled', 'cancelled') then
      raise exception 'terminal booking status cannot change';
    end if;
    if old.status = 'pending' and new.status not in ('confirmed', 'cancelled') then
      raise exception 'pending bookings may only become confirmed or cancelled';
    end if;
    if old.status = 'confirmed' and new.status not in ('fulfilled', 'cancelled') then
      raise exception 'confirmed bookings may only become fulfilled or cancelled';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_bookings_protect_status on public.vendor_bookings;
create trigger vendor_bookings_protect_status
  before update of status on public.vendor_bookings
  for each row execute function private.protect_vendor_booking_status();

-- ---------------------------------------------------------------------------
-- 4. Column-scoped couple-table writes: vendors read-only until P3 RPCs
-- ---------------------------------------------------------------------------
drop policy if exists wedding_vendors_update on public.wedding_vendors;
create policy wedding_vendors_update on public.wedding_vendors
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'vendors.manage'))
  with check (private.has_wedding_permission(wedding_id, 'vendors.manage'));

drop policy if exists vendor_inquiries_update on public.vendor_inquiries;
create policy vendor_inquiries_update on public.vendor_inquiries
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage'))
  with check (private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage'));

drop policy if exists vendor_bookings_update on public.vendor_bookings;
create policy vendor_bookings_update on public.vendor_bookings
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and private.has_wedding_permission(wv.wedding_id, 'vendors.manage')
        and private.has_wedding_permission(wv.wedding_id, 'budget.expenses.update')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and private.has_wedding_permission(wv.wedding_id, 'vendors.manage')
        and private.has_wedding_permission(wv.wedding_id, 'budget.expenses.update')
    )
  );

-- Quotes: insert only draft/sent; freeze identity fields after sent (S5)
drop policy if exists vendor_quotes_insert on public.vendor_quotes;
create policy vendor_quotes_insert on public.vendor_quotes
  for insert to authenticated
  with check (
    status in ('draft', 'sent')
    and exists (
      select 1 from public.vendor_inquiries i
      where i.id = inquiry_id and private.is_vendor_team_member(i.vendor_id)
    )
  );

create or replace function private.protect_vendor_quote_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
begin
  if tg_op = 'UPDATE'
     and old.status <> 'draft'
     and v_jwt_role is distinct from 'service_role'
     and v_db_user not in ('postgres', 'supabase_admin') then
    if new.inquiry_id is distinct from old.inquiry_id
       or new.amount is distinct from old.amount
       or new.package_id is distinct from old.package_id
       or new.currency_code is distinct from old.currency_code then
      raise exception 'sent quotes cannot change amount, package, or inquiry';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vendor_quotes_protect_integrity on public.vendor_quotes;
create trigger vendor_quotes_protect_integrity
  before update on public.vendor_quotes
  for each row execute function private.protect_vendor_quote_integrity();

-- ---------------------------------------------------------------------------
-- 5. Slug helper + create_vendor + submit_vendor_for_verification
-- ---------------------------------------------------------------------------
create or replace function private.slugify_vendor_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base text;
begin
  v_base := lower(regexp_replace(coalesce(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base is null or v_base = '' then
    return 'business';
  end if;
  return left(v_base, 60);
end;
$$;

create or replace function public.create_vendor(
  p_business_name text,
  p_category_ids uuid[],
  p_city text default null,
  p_description text default null,
  p_phone text default null,
  p_email text default null
)
returns public.vendors
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_uid uuid := auth.uid();
  v_vendor public.vendors;
  v_base text;
  v_slug text;
  v_n integer := 0;
  v_category uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_business_name is null or length(btrim(p_business_name)) < 2 then
    raise exception 'business_name is required';
  end if;
  if p_category_ids is null or cardinality(p_category_ids) = 0 then
    raise exception 'at least one category is required';
  end if;

  foreach v_category in array p_category_ids loop
    if not exists (select 1 from public.vendor_categories c where c.id = v_category) then
      raise exception 'invalid category_id';
    end if;
  end loop;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  v_base := private.slugify_vendor_name(p_business_name);
  v_slug := v_base;
  while exists (select 1 from public.vendors v where v.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := left(v_base, 50) || '-' || v_n::text;
  end loop;

  insert into public.vendors (
    owner_user_id, business_name, slug, description, city, phone, email,
    verification_status, listing_status
  ) values (
    v_uid,
    btrim(p_business_name),
    v_slug,
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_city, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    'unverified',
    'draft'
  )
  returning * into v_vendor;

  insert into public.vendor_team_members (vendor_id, user_id, role)
  values (v_vendor.id, v_uid, 'owner');

  insert into public.vendor_category_memberships (vendor_id, category_id)
  select distinct v_vendor.id, category_id
  from unnest(p_category_ids) as category_id
  on conflict do nothing;

  return v_vendor;
end;
$$;

revoke all on function public.create_vendor(text, uuid[], text, text, text, text) from public, anon;
grant execute on function public.create_vendor(text, uuid[], text, text, text, text) to authenticated, service_role;

create or replace function public.submit_vendor_for_verification(p_vendor_id uuid)
returns public.vendors
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_uid uuid := auth.uid();
  v_vendor public.vendors;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_vendor_id is null then
    raise exception 'vendor_id is required';
  end if;

  select * into v_vendor
  from public.vendors v
  where v.id = p_vendor_id
  for update;

  if not found then
    raise exception 'vendor not found';
  end if;
  if v_vendor.owner_user_id is distinct from v_uid then
    raise exception 'only the business owner can submit for verification';
  end if;
  if v_vendor.listing_status = 'suspended' then
    raise exception 'suspended businesses cannot be submitted for verification';
  end if;
  if v_vendor.verification_status not in ('unverified', 'rejected') then
    raise exception 'only unverified or rejected businesses can be submitted';
  end if;
  if length(btrim(v_vendor.business_name)) < 2 then
    raise exception 'business name is required';
  end if;
  if v_vendor.city is null or length(btrim(v_vendor.city)) = 0 then
    raise exception 'city is required before submission';
  end if;
  if v_vendor.description is null or length(btrim(v_vendor.description)) < 20 then
    raise exception 'add a short description (at least 20 characters) before submission';
  end if;
  if (v_vendor.phone is null or length(btrim(v_vendor.phone)) = 0)
     and (v_vendor.email is null or length(btrim(v_vendor.email)) = 0) then
    raise exception 'phone or email is required before submission';
  end if;
  if not exists (
    select 1 from public.vendor_category_memberships m where m.vendor_id = p_vendor_id
  ) then
    raise exception 'at least one category is required before submission';
  end if;

  update public.vendors
  set verification_status = 'pending', updated_at = now()
  where id = p_vendor_id
  returning * into v_vendor;

  return v_vendor;
end;
$$;

revoke all on function public.submit_vendor_for_verification(uuid) from public, anon;
grant execute on function public.submit_vendor_for_verification(uuid) to authenticated, service_role;

-- submit_vendor_for_verification must be allowed to flip verification_status.
-- The protect trigger blocks non-privileged UPDATEs of verification_status, so the
-- RPC (security definer as the migration owner) runs as a privileged DB role.
-- Confirm by ensuring the function owner is a superuser / table owner (default).
