-- Row Level Security for all public API tables.
-- PROVISIONAL role capabilities — see docs/database-security.md.
-- Direct client inserts into weddings / wedding_members are denied; use RPCs.

-- Enable RLS on every public table
do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lookup / reference tables: authenticated read; no client writes
-- ---------------------------------------------------------------------------
create policy task_categories_select on public.task_categories
  for select to authenticated, anon using (is_active = true);
create policy checklist_templates_select on public.checklist_templates
  for select to authenticated, anon using (is_active = true);
create policy vendor_categories_select on public.vendor_categories
  for select to authenticated, anon using (true);
create policy budget_categories_select on public.budget_categories
  for select to authenticated, anon using (true);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select_self_or_peer on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.wedding_members me
      join public.wedding_members peer on peer.wedding_id = me.wedding_id
      where me.user_id = (select auth.uid()) and peer.user_id = profiles.id
    )
    or exists (
      select 1 from public.vendor_team_members me
      join public.vendor_team_members peer on peer.vendor_id = me.vendor_id
      where me.user_id = (select auth.uid()) and peer.user_id = profiles.id
    )
    or exists (
      select 1 from public.vendors v
      where v.owner_user_id = profiles.id
        and private.is_vendor_team_member(v.id)
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No client insert/delete: auth trigger creates rows; deletes via auth cascade

-- ---------------------------------------------------------------------------
-- weddings — select for members; update for writers; no direct insert/delete
-- ---------------------------------------------------------------------------
create policy weddings_select_member on public.weddings
  for select to authenticated
  using (private.is_wedding_member(id));

create policy weddings_update_writer on public.weddings
  for update to authenticated
  using (private.can_write_wedding(id))
  with check (private.can_write_wedding(id));

-- ---------------------------------------------------------------------------
-- wedding_members — members read; owners manage via RPC (no direct writes)
-- ---------------------------------------------------------------------------
create policy wedding_members_select on public.wedding_members
  for select to authenticated
  using (private.is_wedding_member(wedding_id));

-- ---------------------------------------------------------------------------
-- wedding_invites — owners/partners can read metadata; token_hash column revoked below
-- ---------------------------------------------------------------------------
create policy wedding_invites_select_owner on public.wedding_invites
  for select to authenticated
  using (private.is_wedding_owner(wedding_id));

create policy wedding_invites_update_owner on public.wedding_invites
  for update to authenticated
  using (private.is_wedding_owner(wedding_id))
  with check (private.is_wedding_owner(wedding_id));

-- ---------------------------------------------------------------------------
-- Generic wedding-scoped content policies
-- ---------------------------------------------------------------------------
create policy wedding_events_select on public.wedding_events
  for select to authenticated
  using (private.is_wedding_member(wedding_id));
create policy wedding_events_insert on public.wedding_events
  for insert to authenticated
  with check (private.can_write_wedding(wedding_id));
create policy wedding_events_update on public.wedding_events
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy wedding_events_delete on public.wedding_events
  for delete to authenticated
  using (private.can_write_wedding(wedding_id));

create policy wedding_tasks_select on public.wedding_tasks
  for select to authenticated
  using (private.is_wedding_member(wedding_id));
create policy wedding_tasks_insert on public.wedding_tasks
  for insert to authenticated
  with check (private.can_write_wedding(wedding_id));
create policy wedding_tasks_update on public.wedding_tasks
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy wedding_tasks_delete on public.wedding_tasks
  for delete to authenticated
  using (private.can_write_wedding(wedding_id));

create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.is_wedding_member(t.wedding_id)
    )
  );
create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.can_write_wedding(t.wedding_id)
    )
    and private.is_wedding_member(
      (select t.wedding_id from public.wedding_tasks t where t.id = task_id)
    )
    and exists (
      select 1 from public.wedding_members m
      join public.wedding_tasks t on t.wedding_id = m.wedding_id
      where t.id = task_id and m.user_id = task_assignees.user_id
    )
  );
create policy task_assignees_delete on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.can_write_wedding(t.wedding_id)
    )
  );

create policy task_comments_select on public.task_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.is_wedding_member(t.wedding_id)
    )
  );
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.can_write_wedding(t.wedding_id)
    )
  );
create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.is_wedding_owner(t.wedding_id)
    )
  );

-- Guests / groups / invitations / RSVP / seating / timeline / files / budget
create policy guest_groups_select on public.guest_groups
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy guest_groups_insert on public.guest_groups
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy guest_groups_update on public.guest_groups
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy guest_groups_delete on public.guest_groups
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy guests_select on public.guests
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy guests_insert on public.guests
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy guests_update on public.guests
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy guests_delete on public.guests
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy invitation_designs_select on public.invitation_designs
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy invitation_designs_insert on public.invitation_designs
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy invitation_designs_update on public.invitation_designs
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy invitation_designs_delete on public.invitation_designs
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy invitations_select on public.invitations
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy invitations_insert on public.invitations
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy invitations_update on public.invitations
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy invitations_delete on public.invitations
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy invitation_events_select on public.invitation_events
  for select to authenticated
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id and private.is_wedding_member(i.wedding_id)
    )
  );
create policy invitation_events_insert on public.invitation_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id and private.can_write_wedding(i.wedding_id)
    )
  );
create policy invitation_events_delete on public.invitation_events
  for delete to authenticated
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id and private.can_write_wedding(i.wedding_id)
    )
  );

create policy guest_rsvps_select on public.guest_rsvps
  for select to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id and private.is_wedding_member(g.wedding_id)
    )
  );
create policy guest_rsvps_insert on public.guest_rsvps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.guests g
      where g.id = guest_id and private.can_write_wedding(g.wedding_id)
    )
  );
create policy guest_rsvps_update on public.guest_rsvps
  for update to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id and private.can_write_wedding(g.wedding_id)
    )
  )
  with check (
    exists (
      select 1 from public.guests g
      where g.id = guest_id and private.can_write_wedding(g.wedding_id)
    )
  );
create policy guest_rsvps_delete on public.guest_rsvps
  for delete to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id and private.can_write_wedding(g.wedding_id)
    )
  );

create policy seating_tables_select on public.seating_tables
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.is_wedding_member(e.wedding_id)
    )
  );
create policy seating_tables_insert on public.seating_tables
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy seating_tables_update on public.seating_tables
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy seating_tables_delete on public.seating_tables
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );

create policy seating_assignments_select on public.seating_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.is_wedding_member(e.wedding_id)
    )
  );
create policy seating_assignments_insert on public.seating_assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy seating_assignments_update on public.seating_assignments
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy seating_assignments_delete on public.seating_assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );

create policy timeline_items_select on public.timeline_items
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.is_wedding_member(e.wedding_id)
    )
  );
create policy timeline_items_insert on public.timeline_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy timeline_items_update on public.timeline_items
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );
create policy timeline_items_delete on public.timeline_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.can_write_wedding(e.wedding_id)
    )
  );

create policy wedding_files_select on public.wedding_files
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy wedding_files_insert on public.wedding_files
  for insert to authenticated
  with check (
    private.can_write_wedding(wedding_id)
    and uploaded_by = (select auth.uid())
  );
create policy wedding_files_delete on public.wedding_files
  for delete to authenticated
  using (
    private.can_write_wedding(wedding_id)
  );

create policy wedding_budgets_select on public.wedding_budgets
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy wedding_budgets_update on public.wedding_budgets
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
-- insert happens inside create_wedding RPC (security definer)

create policy budget_items_select on public.budget_items
  for select to authenticated using (private.is_wedding_member(wedding_id));
create policy budget_items_insert on public.budget_items
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy budget_items_update on public.budget_items
  for update to authenticated
  using (private.can_write_wedding(wedding_id))
  with check (private.can_write_wedding(wedding_id));
create policy budget_items_delete on public.budget_items
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy expense_payments_select on public.expense_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.budget_items bi
      where bi.id = budget_item_id and private.is_wedding_member(bi.wedding_id)
    )
  );
create policy expense_payments_insert on public.expense_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.budget_items bi
      where bi.id = budget_item_id and private.can_write_wedding(bi.wedding_id)
    )
  );
create policy expense_payments_update on public.expense_payments
  for update to authenticated
  using (
    exists (
      select 1 from public.budget_items bi
      where bi.id = budget_item_id and private.can_write_wedding(bi.wedding_id)
    )
  )
  with check (
    exists (
      select 1 from public.budget_items bi
      where bi.id = budget_item_id and private.can_write_wedding(bi.wedding_id)
    )
  );
create policy expense_payments_delete on public.expense_payments
  for delete to authenticated
  using (
    exists (
      select 1 from public.budget_items bi
      where bi.id = budget_item_id and private.can_write_wedding(bi.wedding_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Vendors marketplace
-- ---------------------------------------------------------------------------
create policy vendors_select_public_or_team on public.vendors
  for select to authenticated, anon
  using (
    (listing_status = 'published' and verification_status = 'verified')
    or (select auth.uid()) is not null and private.is_vendor_team_member(id)
  );

create policy vendors_insert_owner on public.vendors
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy vendors_update_managers on public.vendors
  for update to authenticated
  using (private.can_manage_vendor(id))
  with check (private.can_manage_vendor(id));

-- Prevent clients from changing verification_status (no admin role yet — audit Q2)
create or replace function private.protect_vendor_verification()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_jwt_role text := coalesce(auth.role(), '');
  v_db_user text := current_user;
begin
  -- Allow service_role JWT and local DB superusers (postgres / supabase_admin).
  -- Block authenticated/anon clients until an admin model exists (audit Q2).
  if tg_op = 'UPDATE'
     and new.verification_status is distinct from old.verification_status
     and v_jwt_role is distinct from 'service_role'
     and v_db_user not in ('postgres', 'supabase_admin') then
    raise exception 'verification_status can only be changed by service role until an admin model exists';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_protect_verification on public.vendors;
create trigger vendors_protect_verification
  before update of verification_status on public.vendors
  for each row execute function private.protect_vendor_verification();

create policy vendor_team_members_select on public.vendor_team_members
  for select to authenticated
  using (private.is_vendor_team_member(vendor_id));
create policy vendor_team_members_insert on public.vendor_team_members
  for insert to authenticated
  with check (private.can_manage_vendor(vendor_id));
create policy vendor_team_members_update on public.vendor_team_members
  for update to authenticated
  using (private.can_manage_vendor(vendor_id))
  with check (private.can_manage_vendor(vendor_id));
create policy vendor_team_members_delete on public.vendor_team_members
  for delete to authenticated
  using (private.can_manage_vendor(vendor_id));

create policy vendor_category_memberships_select on public.vendor_category_memberships
  for select to authenticated, anon
  using (
    private.is_public_vendor(vendor_id)
    or ((select auth.uid()) is not null and private.is_vendor_team_member(vendor_id))
  );
create policy vendor_category_memberships_write on public.vendor_category_memberships
  for all to authenticated
  using (private.can_manage_vendor(vendor_id))
  with check (private.can_manage_vendor(vendor_id));

create policy vendor_services_select on public.vendor_services
  for select to authenticated, anon
  using (
    (is_active = true and private.is_public_vendor(vendor_id))
    or ((select auth.uid()) is not null and private.is_vendor_team_member(vendor_id))
  );
create policy vendor_services_write on public.vendor_services
  for all to authenticated
  using (private.can_manage_vendor(vendor_id))
  with check (private.can_manage_vendor(vendor_id));

create policy vendor_packages_select on public.vendor_packages
  for select to authenticated, anon
  using (
    exists (
      select 1 from public.vendor_services s
      where s.id = service_id
        and (
          (s.is_active and vendor_packages.is_active and private.is_public_vendor(s.vendor_id))
          or ((select auth.uid()) is not null and private.is_vendor_team_member(s.vendor_id))
        )
    )
  );
create policy vendor_packages_write on public.vendor_packages
  for all to authenticated
  using (
    exists (
      select 1 from public.vendor_services s
      where s.id = service_id and private.can_manage_vendor(s.vendor_id)
    )
  )
  with check (
    exists (
      select 1 from public.vendor_services s
      where s.id = service_id and private.can_manage_vendor(s.vendor_id)
    )
  );

create policy vendor_media_select on public.vendor_media
  for select to authenticated, anon
  using (
    private.is_public_vendor(vendor_id)
    or ((select auth.uid()) is not null and private.is_vendor_team_member(vendor_id))
  );
create policy vendor_media_write on public.vendor_media
  for all to authenticated
  using (private.can_manage_vendor(vendor_id))
  with check (private.can_manage_vendor(vendor_id));

create policy vendor_availability_select on public.vendor_availability
  for select to authenticated, anon
  using (
    private.is_public_vendor(vendor_id)
    or ((select auth.uid()) is not null and private.is_vendor_team_member(vendor_id))
  );
create policy vendor_availability_write on public.vendor_availability
  for all to authenticated
  using (private.can_manage_vendor(vendor_id))
  with check (private.can_manage_vendor(vendor_id));

-- Wedding ↔ vendor commercial tables
create policy wedding_vendors_select on public.wedding_vendors
  for select to authenticated
  using (
    private.is_wedding_member(wedding_id)
    or (vendor_id is not null and private.is_vendor_team_member(vendor_id))
  );
create policy wedding_vendors_insert on public.wedding_vendors
  for insert to authenticated with check (private.can_write_wedding(wedding_id));
create policy wedding_vendors_update on public.wedding_vendors
  for update to authenticated
  using (
    private.can_write_wedding(wedding_id)
    or (vendor_id is not null and private.is_vendor_team_member(vendor_id))
  )
  with check (
    private.can_write_wedding(wedding_id)
    or (vendor_id is not null and private.is_vendor_team_member(vendor_id))
  );
create policy wedding_vendors_delete on public.wedding_vendors
  for delete to authenticated using (private.can_write_wedding(wedding_id));

create policy vendor_inquiries_select on public.vendor_inquiries
  for select to authenticated
  using (
    private.is_wedding_member(wedding_id)
    or private.is_vendor_team_member(vendor_id)
  );
create policy vendor_inquiries_insert on public.vendor_inquiries
  for insert to authenticated
  with check (
    private.can_write_wedding(wedding_id)
    and created_by = (select auth.uid())
  );
create policy vendor_inquiries_update on public.vendor_inquiries
  for update to authenticated
  using (
    private.can_write_wedding(wedding_id)
    or private.is_vendor_team_member(vendor_id)
  )
  with check (
    private.can_write_wedding(wedding_id)
    or private.is_vendor_team_member(vendor_id)
  );

create policy vendor_quotes_select on public.vendor_quotes
  for select to authenticated
  using (
    exists (
      select 1 from public.vendor_inquiries i
      where i.id = inquiry_id
        and (
          private.is_wedding_member(i.wedding_id)
          or private.is_vendor_team_member(i.vendor_id)
        )
    )
  );
create policy vendor_quotes_insert on public.vendor_quotes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.vendor_inquiries i
      where i.id = inquiry_id and private.is_vendor_team_member(i.vendor_id)
    )
  );
create policy vendor_quotes_update on public.vendor_quotes
  for update to authenticated
  using (
    exists (
      select 1 from public.vendor_inquiries i
      where i.id = inquiry_id
        and (
          private.is_vendor_team_member(i.vendor_id)
          or private.can_write_wedding(i.wedding_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.vendor_inquiries i
      where i.id = inquiry_id
        and (
          private.is_vendor_team_member(i.vendor_id)
          or private.can_write_wedding(i.wedding_id)
        )
    )
  );

create policy vendor_bookings_select on public.vendor_bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.is_wedding_member(wv.wedding_id)
          or (wv.vendor_id is not null and private.is_vendor_team_member(wv.vendor_id))
        )
    )
  );
create policy vendor_bookings_insert on public.vendor_bookings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id and private.can_write_wedding(wv.wedding_id)
    )
  );
create policy vendor_bookings_update on public.vendor_bookings
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.can_write_wedding(wv.wedding_id)
          or (wv.vendor_id is not null and private.is_vendor_team_member(wv.vendor_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.can_write_wedding(wv.wedding_id)
          or (wv.vendor_id is not null and private.is_vendor_team_member(wv.vendor_id))
        )
    )
  );

create policy vendor_reviews_select on public.vendor_reviews
  for select to authenticated, anon
  using (
    status = 'published'
    or (
      (select auth.uid()) is not null
      and (
        private.is_wedding_member(wedding_id)
        or private.is_vendor_team_member(vendor_id)
        or reviewer_id = (select auth.uid())
      )
    )
  );
create policy vendor_reviews_insert on public.vendor_reviews
  for insert to authenticated
  with check (
    reviewer_id = (select auth.uid())
    and private.can_write_wedding(wedding_id)
    and status = 'pending'
  );
create policy vendor_reviews_update_author on public.vendor_reviews
  for update to authenticated
  using (reviewer_id = (select auth.uid()) and status = 'pending')
  with check (reviewer_id = (select auth.uid()) and status = 'pending');

-- ---------------------------------------------------------------------------
-- Column privileges: hide token hashes from API roles
-- ---------------------------------------------------------------------------
-- Hide hashes from API reads. Collaborator invites are created via RPC (hash set server-side).
-- Guest invitation rows may still write token_hash under RLS; a dedicated guest-invite RPC is future work.
revoke select (token_hash) on public.wedding_invites from anon, authenticated;
revoke select (token_hash) on public.invitations from anon, authenticated;
revoke insert (token_hash) on public.wedding_invites from anon, authenticated;
revoke update (token_hash) on public.wedding_invites from anon, authenticated;
