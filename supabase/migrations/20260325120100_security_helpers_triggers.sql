-- Kiburan security helpers, profile provisioning, updated_at, and cross-wedding guards.
-- Conservative role model (PROVISIONAL — pending PM confirmation of docs/schema-audit.md Q1–Q2):
--   viewer: read-only wedding access
--   collaborator / planner / partner: read + write wedding content; cannot manage membership roles
--   owner: full wedding access including membership/invite management
-- Vendor marketplace browse: listing_status = 'published' AND verification_status = 'verified'
-- Admin / vendor-verification tooling is intentionally NOT implemented (open question).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- updated_at automation (tables that already have the column)
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger weddings_set_updated_at
  before update on public.weddings
  for each row execute function private.set_updated_at();

create trigger wedding_tasks_set_updated_at
  before update on public.wedding_tasks
  for each row execute function private.set_updated_at();

create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function private.set_updated_at();

create trigger wedding_budgets_set_updated_at
  before update on public.wedding_budgets
  for each row execute function private.set_updated_at();

-- Keep completed_at aligned with status for wedding_tasks
create or replace function private.sync_task_completed_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status is distinct from 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger wedding_tasks_sync_completed_at
  before insert or update of status on public.wedding_tasks
  for each row execute function private.sync_task_completed_at();

-- ---------------------------------------------------------------------------
-- Auth → profile provisioning
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone, preferred_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    case
      when coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en') in ('en', 'am')
        then coalesce(new.raw_user_meta_data ->> 'preferred_language', 'en')
      else 'en'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Membership / vendor helpers (SECURITY DEFINER, auth.uid() checked inside)
-- ---------------------------------------------------------------------------
create or replace function private.current_uid()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function private.is_wedding_member(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.wedding_member_role(p_wedding_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id
    and m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.can_write_wedding(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'partner', 'planner', 'collaborator')
  );
$$;

create or replace function private.is_wedding_owner(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members m
    where m.wedding_id = p_wedding_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

create or replace function private.is_vendor_team_member(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendor_team_members t
    where t.vendor_id = p_vendor_id
      and t.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.vendors v
    where v.id = p_vendor_id
      and v.owner_user_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendors v
    where v.id = p_vendor_id
      and v.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.vendor_team_members t
    where t.vendor_id = p_vendor_id
      and t.user_id = (select auth.uid())
      and t.role in ('owner', 'manager')
  );
$$;

create or replace function private.is_public_vendor(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendors v
    where v.id = p_vendor_id
      and v.listing_status = 'published'
      and v.verification_status = 'verified'
  );
$$;

grant execute on function private.is_wedding_member(uuid) to anon, authenticated, service_role;
grant execute on function private.wedding_member_role(uuid) to anon, authenticated, service_role;
grant execute on function private.can_write_wedding(uuid) to anon, authenticated, service_role;
grant execute on function private.is_wedding_owner(uuid) to anon, authenticated, service_role;
grant execute on function private.is_vendor_team_member(uuid) to anon, authenticated, service_role;
grant execute on function private.can_manage_vendor(uuid) to anon, authenticated, service_role;
grant execute on function private.is_public_vendor(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Cross-wedding / cross-vendor integrity triggers
-- ---------------------------------------------------------------------------
create or replace function private.assert_event_belongs_to_wedding(p_event_id uuid, p_wedding_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_wedding uuid;
begin
  if p_event_id is null then
    return;
  end if;
  select e.wedding_id into v_event_wedding from public.wedding_events e where e.id = p_event_id;
  if v_event_wedding is null then
    raise exception 'event % not found', p_event_id;
  end if;
  if v_event_wedding <> p_wedding_id then
    raise exception 'cross-wedding reference rejected: event % belongs to wedding %, row wedding is %',
      p_event_id, v_event_wedding, p_wedding_id;
  end if;
end;
$$;

create or replace function private.assert_wedding_tasks_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_event_belongs_to_wedding(new.event_id, new.wedding_id);
  return new;
end;
$$;

create or replace function private.assert_wedding_vendors_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_event_belongs_to_wedding(new.event_id, new.wedding_id);
  return new;
end;
$$;

create or replace function private.assert_vendor_inquiries_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_event_belongs_to_wedding(new.requested_event_id, new.wedding_id);
  return new;
end;
$$;

create trigger wedding_tasks_same_wedding_event
  before insert or update of event_id, wedding_id on public.wedding_tasks
  for each row execute function private.assert_wedding_tasks_event();

create trigger wedding_vendors_same_wedding_event
  before insert or update of event_id, wedding_id on public.wedding_vendors
  for each row execute function private.assert_wedding_vendors_event();

create trigger vendor_inquiries_same_wedding_event
  before insert or update of requested_event_id, wedding_id on public.vendor_inquiries
  for each row execute function private.assert_vendor_inquiries_event();

-- parent task must share wedding
create or replace function private.assert_task_parent_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent_wedding uuid;
begin
  if new.parent_task_id is null then
    return new;
  end if;
  if new.parent_task_id = new.id then
    raise exception 'task cannot be its own parent';
  end if;
  select t.wedding_id into v_parent_wedding from public.wedding_tasks t where t.id = new.parent_task_id;
  if v_parent_wedding is null or v_parent_wedding <> new.wedding_id then
    raise exception 'cross-wedding parent_task_id rejected';
  end if;
  return new;
end;
$$;

create trigger wedding_tasks_parent_same_wedding
  before insert or update of parent_task_id, wedding_id on public.wedding_tasks
  for each row execute function private.assert_task_parent_same_wedding();

-- guests.group_id same wedding
create or replace function private.assert_guest_group_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group_wedding uuid;
begin
  if new.group_id is null then
    return new;
  end if;
  select g.wedding_id into v_group_wedding from public.guest_groups g where g.id = new.group_id;
  if v_group_wedding is null or v_group_wedding <> new.wedding_id then
    raise exception 'cross-wedding guest group rejected';
  end if;
  return new;
end;
$$;

create trigger guests_group_same_wedding
  before insert or update of group_id, wedding_id on public.guests
  for each row execute function private.assert_guest_group_same_wedding();

-- invitations: guest/group/design same wedding
create or replace function private.assert_invitation_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ref_wedding uuid;
begin
  if new.guest_id is not null then
    select g.wedding_id into v_ref_wedding from public.guests g where g.id = new.guest_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding invitation guest rejected';
    end if;
  end if;
  if new.group_id is not null then
    select g.wedding_id into v_ref_wedding from public.guest_groups g where g.id = new.group_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding invitation group rejected';
    end if;
  end if;
  if new.design_id is not null then
    select d.wedding_id into v_ref_wedding from public.invitation_designs d where d.id = new.design_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding invitation design rejected';
    end if;
  end if;
  return new;
end;
$$;

create trigger invitations_same_wedding
  before insert or update of guest_id, group_id, design_id, wedding_id on public.invitations
  for each row execute function private.assert_invitation_same_wedding();

-- invitation_events: event wedding must match invitation wedding
create or replace function private.assert_invitation_event_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inv_wedding uuid;
  v_event_wedding uuid;
begin
  select i.wedding_id into v_inv_wedding from public.invitations i where i.id = new.invitation_id;
  select e.wedding_id into v_event_wedding from public.wedding_events e where e.id = new.event_id;
  if v_inv_wedding is null or v_event_wedding is null or v_inv_wedding <> v_event_wedding then
    raise exception 'cross-wedding invitation_events rejected';
  end if;
  return new;
end;
$$;

create trigger invitation_events_same_wedding
  before insert or update on public.invitation_events
  for each row execute function private.assert_invitation_event_same_wedding();

-- guest_rsvps: guest and event same wedding
create or replace function private.assert_rsvp_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guest_wedding uuid;
  v_event_wedding uuid;
begin
  select g.wedding_id into v_guest_wedding from public.guests g where g.id = new.guest_id;
  select e.wedding_id into v_event_wedding from public.wedding_events e where e.id = new.event_id;
  if v_guest_wedding is null or v_event_wedding is null or v_guest_wedding <> v_event_wedding then
    raise exception 'cross-wedding guest_rsvp rejected';
  end if;
  return new;
end;
$$;

create trigger guest_rsvps_same_wedding
  before insert or update on public.guest_rsvps
  for each row execute function private.assert_rsvp_same_wedding();

-- seating_assignments: table must belong to the assignment event; guest same wedding
create or replace function private.assert_seating_assignment_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_table_event uuid;
  v_guest_wedding uuid;
  v_event_wedding uuid;
begin
  select t.event_id into v_table_event from public.seating_tables t where t.id = new.table_id;
  if v_table_event is null or v_table_event <> new.event_id then
    raise exception 'seating table does not belong to assignment event';
  end if;
  select g.wedding_id into v_guest_wedding from public.guests g where g.id = new.guest_id;
  select e.wedding_id into v_event_wedding from public.wedding_events e where e.id = new.event_id;
  if v_guest_wedding is null or v_event_wedding is null or v_guest_wedding <> v_event_wedding then
    raise exception 'cross-wedding seating assignment rejected';
  end if;
  return new;
end;
$$;

create trigger seating_assignments_integrity
  before insert or update on public.seating_assignments
  for each row execute function private.assert_seating_assignment_integrity();

-- budget_items: wedding_vendor and booking must belong to same wedding
create or replace function private.assert_budget_item_same_wedding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ref_wedding uuid;
begin
  if new.wedding_vendor_id is not null then
    select wv.wedding_id into v_ref_wedding from public.wedding_vendors wv where wv.id = new.wedding_vendor_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding budget wedding_vendor rejected';
    end if;
  end if;
  if new.booking_id is not null then
    select wv.wedding_id into v_ref_wedding
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where b.id = new.booking_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding budget booking rejected';
    end if;
  end if;
  return new;
end;
$$;

create trigger budget_items_same_wedding
  before insert or update of wedding_vendor_id, booking_id, wedding_id on public.budget_items
  for each row execute function private.assert_budget_item_same_wedding();

-- vendor service must match inquiry vendor; package must match inquiry vendor
create or replace function private.assert_inquiry_service_vendor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_vendor uuid;
begin
  if new.service_id is null then
    return new;
  end if;
  select s.vendor_id into v_service_vendor from public.vendor_services s where s.id = new.service_id;
  if v_service_vendor is null or v_service_vendor <> new.vendor_id then
    raise exception 'inquiry service does not belong to inquiry vendor';
  end if;
  return new;
end;
$$;

create trigger vendor_inquiries_service_vendor
  before insert or update of service_id, vendor_id on public.vendor_inquiries
  for each row execute function private.assert_inquiry_service_vendor();

create or replace function private.assert_quote_package_vendor()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inquiry_vendor uuid;
  v_package_vendor uuid;
begin
  if new.package_id is null then
    return new;
  end if;
  select i.vendor_id into v_inquiry_vendor from public.vendor_inquiries i where i.id = new.inquiry_id;
  select s.vendor_id into v_package_vendor
  from public.vendor_packages p
  join public.vendor_services s on s.id = p.service_id
  where p.id = new.package_id;
  if v_inquiry_vendor is null or v_package_vendor is null or v_inquiry_vendor <> v_package_vendor then
    raise exception 'quote package does not belong to inquiry vendor';
  end if;
  return new;
end;
$$;

create trigger vendor_quotes_package_vendor
  before insert or update of package_id, inquiry_id on public.vendor_quotes
  for each row execute function private.assert_quote_package_vendor();

-- wedding_files task/booking same wedding
create or replace function private.assert_wedding_file_refs()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ref_wedding uuid;
begin
  if new.task_id is not null then
    select t.wedding_id into v_ref_wedding from public.wedding_tasks t where t.id = new.task_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding wedding_files.task_id rejected';
    end if;
  end if;
  if new.booking_id is not null then
    select wv.wedding_id into v_ref_wedding
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where b.id = new.booking_id;
    if v_ref_wedding is null or v_ref_wedding <> new.wedding_id then
      raise exception 'cross-wedding wedding_files.booking_id rejected';
    end if;
  end if;
  return new;
end;
$$;

create trigger wedding_files_refs
  before insert or update of task_id, booking_id, wedding_id on public.wedding_files
  for each row execute function private.assert_wedding_file_refs();

-- vendor media / availability service same vendor
create or replace function private.assert_vendor_child_service()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_service_vendor uuid;
begin
  if new.service_id is null then
    return new;
  end if;
  select s.vendor_id into v_service_vendor from public.vendor_services s where s.id = new.service_id;
  if v_service_vendor is null or v_service_vendor <> new.vendor_id then
    raise exception 'service does not belong to vendor';
  end if;
  return new;
end;
$$;

create trigger vendor_media_service_vendor
  before insert or update of service_id, vendor_id on public.vendor_media
  for each row execute function private.assert_vendor_child_service();

create trigger vendor_availability_service_vendor
  before insert or update of service_id, vendor_id on public.vendor_availability
  for each row execute function private.assert_vendor_child_service();

-- Indexes that RLS policies will join on
create index if not exists idx_wedding_invites_wedding on public.wedding_invites (wedding_id);
create index if not exists idx_vendor_team_members_user on public.vendor_team_members (user_id);
create index if not exists idx_vendor_inquiries_wedding on public.vendor_inquiries (wedding_id);
create index if not exists idx_guest_groups_wedding on public.guest_groups (wedding_id);
create index if not exists idx_wedding_files_wedding on public.wedding_files (wedding_id);
create index if not exists idx_vendors_owner on public.vendors (owner_user_id);
