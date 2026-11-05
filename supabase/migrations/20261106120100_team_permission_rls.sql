-- Planning Team, Milestone 5 (2 of 2): replace feature-table RLS with permission helpers.
-- Group-scoped guest isolation beyond wedding-wide permissions is refined in Milestone 6.
-- Vendor marketplace / vendor-team policies are left unchanged except wedding-side tables.

-- ---------------------------------------------------------------------------
-- Weddings: members read; settings only via update_wedding_settings RPC
-- ---------------------------------------------------------------------------

drop policy if exists weddings_update_writer on public.weddings;

-- ---------------------------------------------------------------------------
-- wedding_members: team.view or own row
-- ---------------------------------------------------------------------------

drop policy if exists wedding_members_select on public.wedding_members;
create policy wedding_members_select on public.wedding_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_wedding_permission(wedding_id, 'team.view')
  );

-- ---------------------------------------------------------------------------
-- Timeline
-- ---------------------------------------------------------------------------

drop policy if exists wedding_events_select on public.wedding_events;
drop policy if exists wedding_events_insert on public.wedding_events;
drop policy if exists wedding_events_update on public.wedding_events;
drop policy if exists wedding_events_delete on public.wedding_events;

create policy wedding_events_select on public.wedding_events
  for select to authenticated
  using (private.has_wedding_permission(wedding_id, 'timeline.view'));
create policy wedding_events_insert on public.wedding_events
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'timeline.manage'));
create policy wedding_events_update on public.wedding_events
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'timeline.manage'))
  with check (private.has_wedding_permission(wedding_id, 'timeline.manage'));
create policy wedding_events_delete on public.wedding_events
  for delete to authenticated
  using (private.has_wedding_permission(wedding_id, 'timeline.manage'));

drop policy if exists timeline_items_select on public.timeline_items;
drop policy if exists timeline_items_insert on public.timeline_items;
drop policy if exists timeline_items_update on public.timeline_items;
drop policy if exists timeline_items_delete on public.timeline_items;

create policy timeline_items_select on public.timeline_items
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id
        and private.has_wedding_permission(e.wedding_id, 'timeline.view')
    )
  );
create policy timeline_items_insert on public.timeline_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id
        and private.has_wedding_permission(e.wedding_id, 'timeline.manage')
    )
  );
create policy timeline_items_update on public.timeline_items
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id
        and private.has_wedding_permission(e.wedding_id, 'timeline.manage')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id
        and private.has_wedding_permission(e.wedding_id, 'timeline.manage')
    )
  );
create policy timeline_items_delete on public.timeline_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id
        and private.has_wedding_permission(e.wedding_id, 'timeline.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

drop policy if exists wedding_tasks_select on public.wedding_tasks;
drop policy if exists wedding_tasks_insert on public.wedding_tasks;
drop policy if exists wedding_tasks_update on public.wedding_tasks;
drop policy if exists wedding_tasks_delete on public.wedding_tasks;

create policy wedding_tasks_select on public.wedding_tasks
  for select to authenticated
  using (private.has_wedding_permission(wedding_id, 'tasks.view'));
create policy wedding_tasks_insert on public.wedding_tasks
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'tasks.create'));
create policy wedding_tasks_update on public.wedding_tasks
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'tasks.update'))
  with check (private.has_wedding_permission(wedding_id, 'tasks.update'));
create policy wedding_tasks_delete on public.wedding_tasks
  for delete to authenticated
  using (private.has_wedding_permission(wedding_id, 'tasks.delete'));

drop policy if exists task_assignees_select on public.task_assignees;
drop policy if exists task_assignees_insert on public.task_assignees;
drop policy if exists task_assignees_delete on public.task_assignees;

create policy task_assignees_select on public.task_assignees
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.has_wedding_permission(t.wedding_id, 'tasks.view')
    )
  );
create policy task_assignees_insert on public.task_assignees
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.has_wedding_permission(t.wedding_id, 'tasks.assign')
    )
    and private.is_wedding_member(
      (select t.wedding_id from public.wedding_tasks t where t.id = task_id)
    )
    and user_id in (
      select m.user_id from public.wedding_members m
      where m.wedding_id = (select t.wedding_id from public.wedding_tasks t where t.id = task_id)
    )
  );
create policy task_assignees_delete on public.task_assignees
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.has_wedding_permission(t.wedding_id, 'tasks.assign')
    )
  );

drop policy if exists task_comments_select on public.task_comments;
drop policy if exists task_comments_insert on public.task_comments;
drop policy if exists task_comments_delete on public.task_comments;

create policy task_comments_select on public.task_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id and private.has_wedding_permission(t.wedding_id, 'tasks.view')
    )
  );
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.wedding_tasks t
      where t.id = task_id
        and (
          private.has_wedding_permission(t.wedding_id, 'tasks.comment')
          or exists (
            select 1 from public.task_assignees a
            where a.task_id = t.id and a.user_id = (select auth.uid())
          )
        )
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

-- ---------------------------------------------------------------------------
-- Guests (wedding-wide permissions in M5; group scoping refined in M6)
-- ---------------------------------------------------------------------------

drop policy if exists guest_groups_select on public.guest_groups;
drop policy if exists guest_groups_insert on public.guest_groups;
drop policy if exists guest_groups_update on public.guest_groups;
drop policy if exists guest_groups_delete on public.guest_groups;

create policy guest_groups_select on public.guest_groups
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.view')
    or private.can_access_guest_group(wedding_id, id, 'view')
  );
create policy guest_groups_insert on public.guest_groups
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'guests.manage_all'));
create policy guest_groups_update on public.guest_groups
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'guests.manage_all'))
  with check (private.has_wedding_permission(wedding_id, 'guests.manage_all'));
create policy guest_groups_delete on public.guest_groups
  for delete to authenticated
  using (private.has_wedding_permission(wedding_id, 'guests.manage_all'));

drop policy if exists guests_select on public.guests;
drop policy if exists guests_insert on public.guests;
drop policy if exists guests_update on public.guests;
drop policy if exists guests_delete on public.guests;

create policy guests_select on public.guests
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.view')
    or private.can_access_guest_group(wedding_id, group_id, 'view')
  );
create policy guests_insert on public.guests
  for insert to authenticated
  with check (
    private.has_wedding_permission(wedding_id, 'guests.create')
    or private.can_access_guest_group(wedding_id, group_id, 'create')
  );
create policy guests_update on public.guests
  for update to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.update')
    or private.can_access_guest_group(wedding_id, group_id, 'update')
  )
  with check (
    private.has_wedding_permission(wedding_id, 'guests.update')
    or private.can_access_guest_group(wedding_id, group_id, 'update')
  );
create policy guests_delete on public.guests
  for delete to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.delete')
    or private.can_access_guest_group(wedding_id, group_id, 'delete')
  );

drop policy if exists invitation_designs_select on public.invitation_designs;
drop policy if exists invitation_designs_insert on public.invitation_designs;
drop policy if exists invitation_designs_update on public.invitation_designs;
drop policy if exists invitation_designs_delete on public.invitation_designs;

create policy invitation_designs_select on public.invitation_designs
  for select to authenticated
  using (private.has_wedding_permission(wedding_id, 'guests.view'));
create policy invitation_designs_insert on public.invitation_designs
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'guests.send_invitations'));
create policy invitation_designs_update on public.invitation_designs
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'guests.send_invitations'))
  with check (private.has_wedding_permission(wedding_id, 'guests.send_invitations'));
create policy invitation_designs_delete on public.invitation_designs
  for delete to authenticated
  using (private.has_wedding_permission(wedding_id, 'guests.send_invitations'));

drop policy if exists invitations_select on public.invitations;
drop policy if exists invitations_insert on public.invitations;
drop policy if exists invitations_update on public.invitations;
drop policy if exists invitations_delete on public.invitations;

create policy invitations_select on public.invitations
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.view')
    or private.can_access_guest_group(wedding_id, group_id, 'view')
  );
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (private.can_send_guest_invitations(wedding_id, group_id, guest_id));
create policy invitations_update on public.invitations
  for update to authenticated
  using (private.can_send_guest_invitations(wedding_id, group_id, guest_id))
  with check (private.can_send_guest_invitations(wedding_id, group_id, guest_id));
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (private.can_send_guest_invitations(wedding_id, group_id, guest_id));

drop policy if exists invitation_events_select on public.invitation_events;
drop policy if exists invitation_events_insert on public.invitation_events;
drop policy if exists invitation_events_delete on public.invitation_events;

create policy invitation_events_select on public.invitation_events
  for select to authenticated
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id
        and (
          private.has_wedding_permission(i.wedding_id, 'guests.view')
          or private.can_access_guest_group(i.wedding_id, i.group_id, 'view')
        )
    )
  );
create policy invitation_events_insert on public.invitation_events
  for insert to authenticated
  with check (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id
        and private.can_send_guest_invitations(i.wedding_id, i.group_id, i.guest_id)
    )
  );
create policy invitation_events_delete on public.invitation_events
  for delete to authenticated
  using (
    exists (
      select 1 from public.invitations i
      where i.id = invitation_id
        and private.can_send_guest_invitations(i.wedding_id, i.group_id, i.guest_id)
    )
  );

drop policy if exists guest_rsvps_select on public.guest_rsvps;
drop policy if exists guest_rsvps_insert on public.guest_rsvps;
drop policy if exists guest_rsvps_update on public.guest_rsvps;
drop policy if exists guest_rsvps_delete on public.guest_rsvps;

create policy guest_rsvps_select on public.guest_rsvps
  for select to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id
        and (
          private.has_wedding_permission(g.wedding_id, 'guests.view')
          or private.can_access_guest_group(g.wedding_id, g.group_id, 'view')
        )
    )
  );
create policy guest_rsvps_insert on public.guest_rsvps
  for insert to authenticated
  with check (
    exists (
      select 1 from public.guests g
      where g.id = guest_id
        and (
          private.has_wedding_permission(g.wedding_id, 'guests.update')
          or private.can_access_guest_group(g.wedding_id, g.group_id, 'update')
        )
    )
  );
create policy guest_rsvps_update on public.guest_rsvps
  for update to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id
        and (
          private.has_wedding_permission(g.wedding_id, 'guests.update')
          or private.can_access_guest_group(g.wedding_id, g.group_id, 'update')
        )
    )
  )
  with check (
    exists (
      select 1 from public.guests g
      where g.id = guest_id
        and (
          private.has_wedding_permission(g.wedding_id, 'guests.update')
          or private.can_access_guest_group(g.wedding_id, g.group_id, 'update')
        )
    )
  );
create policy guest_rsvps_delete on public.guest_rsvps
  for delete to authenticated
  using (
    exists (
      select 1 from public.guests g
      where g.id = guest_id
        and (
          private.has_wedding_permission(g.wedding_id, 'guests.update')
          or private.can_access_guest_group(g.wedding_id, g.group_id, 'update')
        )
    )
  );

drop policy if exists seating_tables_select on public.seating_tables;
drop policy if exists seating_tables_insert on public.seating_tables;
drop policy if exists seating_tables_update on public.seating_tables;
drop policy if exists seating_tables_delete on public.seating_tables;

create policy seating_tables_select on public.seating_tables
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.view')
    )
  );
create policy seating_tables_insert on public.seating_tables
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );
create policy seating_tables_update on public.seating_tables
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );
create policy seating_tables_delete on public.seating_tables
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );

drop policy if exists seating_assignments_select on public.seating_assignments;
drop policy if exists seating_assignments_insert on public.seating_assignments;
drop policy if exists seating_assignments_update on public.seating_assignments;
drop policy if exists seating_assignments_delete on public.seating_assignments;

create policy seating_assignments_select on public.seating_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.view')
    )
  );
create policy seating_assignments_insert on public.seating_assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );
create policy seating_assignments_update on public.seating_assignments
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  )
  with check (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );
create policy seating_assignments_delete on public.seating_assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.wedding_events e
      where e.id = event_id and private.has_wedding_permission(e.wedding_id, 'guests.manage_all')
    )
  );

-- ---------------------------------------------------------------------------
-- Vendors (wedding side)
-- ---------------------------------------------------------------------------

drop policy if exists wedding_vendors_select on public.wedding_vendors;
drop policy if exists wedding_vendors_insert on public.wedding_vendors;
drop policy if exists wedding_vendors_update on public.wedding_vendors;
drop policy if exists wedding_vendors_delete on public.wedding_vendors;

create policy wedding_vendors_select on public.wedding_vendors
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'vendors.view')
    or private.is_vendor_team_member(vendor_id)
  );
create policy wedding_vendors_insert on public.wedding_vendors
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'vendors.manage'));
create policy wedding_vendors_update on public.wedding_vendors
  for update to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'vendors.manage')
    or private.is_vendor_team_member(vendor_id)
  )
  with check (
    private.has_wedding_permission(wedding_id, 'vendors.manage')
    or private.is_vendor_team_member(vendor_id)
  );
create policy wedding_vendors_delete on public.wedding_vendors
  for delete to authenticated
  using (private.has_wedding_permission(wedding_id, 'vendors.manage'));

-- vendor_inquiries / vendor_bookings: keep vendor-team access; tighten wedding side
drop policy if exists vendor_inquiries_select on public.vendor_inquiries;
drop policy if exists vendor_inquiries_insert on public.vendor_inquiries;
drop policy if exists vendor_inquiries_update on public.vendor_inquiries;

create policy vendor_inquiries_select on public.vendor_inquiries
  for select to authenticated
  using (
    private.is_vendor_team_member(vendor_id)
    or private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage')
    or private.has_wedding_permission(wedding_id, 'budget.expenses.view')
  );
create policy vendor_inquiries_insert on public.vendor_inquiries
  for insert to authenticated
  with check (private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage'));
create policy vendor_inquiries_update on public.vendor_inquiries
  for update to authenticated
  using (
    private.is_vendor_team_member(vendor_id)
    or private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage')
  )
  with check (
    private.is_vendor_team_member(vendor_id)
    or private.has_wedding_permission(wedding_id, 'vendors.inquiries.manage')
  );

drop policy if exists vendor_bookings_select on public.vendor_bookings;
drop policy if exists vendor_bookings_insert on public.vendor_bookings;
drop policy if exists vendor_bookings_update on public.vendor_bookings;

create policy vendor_bookings_select on public.vendor_bookings
  for select to authenticated
  using (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.is_vendor_team_member(wv.vendor_id)
          or private.has_wedding_permission(wv.wedding_id, 'budget.expenses.view')
        )
    )
  );
create policy vendor_bookings_insert on public.vendor_bookings
  for insert to authenticated
  with check (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and private.has_wedding_permission(wv.wedding_id, 'vendors.manage')
        and private.has_wedding_permission(wv.wedding_id, 'budget.expenses.create')
    )
  );
create policy vendor_bookings_update on public.vendor_bookings
  for update to authenticated
  using (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.is_vendor_team_member(wv.vendor_id)
          or (
            private.has_wedding_permission(wv.wedding_id, 'vendors.manage')
            and private.has_wedding_permission(wv.wedding_id, 'budget.expenses.update')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.wedding_vendors wv
      where wv.id = wedding_vendor_id
        and (
          private.is_vendor_team_member(wv.vendor_id)
          or (
            private.has_wedding_permission(wv.wedding_id, 'vendors.manage')
            and private.has_wedding_permission(wv.wedding_id, 'budget.expenses.update')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Budget
-- ---------------------------------------------------------------------------

drop policy if exists wedding_budgets_select on public.wedding_budgets;
drop policy if exists wedding_budgets_update on public.wedding_budgets;

create policy wedding_budgets_select on public.wedding_budgets
  for select to authenticated
  using (private.has_wedding_permission(wedding_id, 'budget.view'));
create policy wedding_budgets_update on public.wedding_budgets
  for update to authenticated
  using (private.has_wedding_permission(wedding_id, 'budget.manage'))
  with check (private.has_wedding_permission(wedding_id, 'budget.manage'));

drop policy if exists budget_items_select on public.budget_items;
drop policy if exists budget_items_insert on public.budget_items;
drop policy if exists budget_items_update on public.budget_items;
drop policy if exists budget_items_delete on public.budget_items;

create policy budget_items_select on public.budget_items
  for select to authenticated
  using (
    case item_kind
      when 'allocation' then private.has_wedding_permission(wedding_id, 'budget.view')
      else private.has_wedding_permission(wedding_id, 'budget.expenses.view')
    end
  );
create policy budget_items_insert on public.budget_items
  for insert to authenticated
  with check (
    case item_kind
      when 'allocation' then private.has_wedding_permission(wedding_id, 'budget.manage')
      else private.has_wedding_permission(wedding_id, 'budget.expenses.create')
    end
  );
create policy budget_items_update on public.budget_items
  for update to authenticated
  using (
    case item_kind
      when 'allocation' then private.has_wedding_permission(wedding_id, 'budget.manage')
      else private.has_wedding_permission(wedding_id, 'budget.expenses.update')
    end
  )
  with check (
    case item_kind
      when 'allocation' then private.has_wedding_permission(wedding_id, 'budget.manage')
      else private.has_wedding_permission(wedding_id, 'budget.expenses.update')
    end
  );
create policy budget_items_delete on public.budget_items
  for delete to authenticated
  using (
    case item_kind
      when 'allocation' then private.has_wedding_permission(wedding_id, 'budget.manage')
      else private.has_wedding_permission(wedding_id, 'budget.expenses.delete')
    end
  );

drop policy if exists expense_payments_select on public.expense_payments;
drop policy if exists expense_payments_insert on public.expense_payments;
drop policy if exists expense_payments_update on public.expense_payments;
drop policy if exists expense_payments_delete on public.expense_payments;

create policy expense_payments_select on public.expense_payments
  for select to authenticated
  using (
    exists (
      select 1 from public.budget_items i
      where i.id = budget_item_id
        and private.has_wedding_permission(i.wedding_id, 'budget.payments.view')
    )
  );
create policy expense_payments_insert on public.expense_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.budget_items i
      where i.id = budget_item_id
        and private.has_wedding_permission(i.wedding_id, 'budget.expenses.update')
    )
  );
create policy expense_payments_update on public.expense_payments
  for update to authenticated
  using (
    exists (
      select 1 from public.budget_items i
      where i.id = budget_item_id
        and private.has_wedding_permission(i.wedding_id, 'budget.expenses.update')
    )
  )
  with check (
    exists (
      select 1 from public.budget_items i
      where i.id = budget_item_id
        and private.has_wedding_permission(i.wedding_id, 'budget.expenses.update')
    )
  );
create policy expense_payments_delete on public.expense_payments
  for delete to authenticated
  using (
    exists (
      select 1 from public.budget_items i
      where i.id = budget_item_id
        and private.has_wedding_permission(i.wedding_id, 'budget.expenses.update')
    )
  );

-- ---------------------------------------------------------------------------
-- Documents / files
-- ---------------------------------------------------------------------------

drop policy if exists wedding_files_select on public.wedding_files;
drop policy if exists wedding_files_insert on public.wedding_files;
drop policy if exists wedding_files_update on public.wedding_files;
drop policy if exists wedding_files_delete on public.wedding_files;

create policy wedding_files_select on public.wedding_files
  for select to authenticated
  using (
    case
      when booking_id is not null then
        private.has_wedding_permission(wedding_id, 'budget.payments.view')
      else
        private.has_wedding_permission(wedding_id, 'documents.view')
    end
  );
create policy wedding_files_insert on public.wedding_files
  for insert to authenticated
  with check (
    case
      when booking_id is not null then
        private.has_wedding_permission(wedding_id, 'budget.expenses.update')
      else
        private.has_wedding_permission(wedding_id, 'documents.manage')
    end
  );
create policy wedding_files_update on public.wedding_files
  for update to authenticated
  using (
    case
      when booking_id is not null then
        private.has_wedding_permission(wedding_id, 'budget.expenses.update')
      else
        private.has_wedding_permission(wedding_id, 'documents.manage')
    end
  )
  with check (
    case
      when booking_id is not null then
        private.has_wedding_permission(wedding_id, 'budget.expenses.update')
      else
        private.has_wedding_permission(wedding_id, 'documents.manage')
    end
  );
create policy wedding_files_delete on public.wedding_files
  for delete to authenticated
  using (
    case
      when booking_id is not null then
        private.has_wedding_permission(wedding_id, 'budget.expenses.update')
      else
        private.has_wedding_permission(wedding_id, 'documents.manage')
    end
  );

-- Storage: documents and covers
drop policy if exists wedding_documents_select on storage.objects;
drop policy if exists wedding_documents_insert on storage.objects;
drop policy if exists wedding_documents_update on storage.objects;
drop policy if exists wedding_documents_delete on storage.objects;

create policy wedding_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'documents.view')
  );
create policy wedding_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wedding-documents'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'documents.manage')
  );
create policy wedding_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'documents.manage')
  )
  with check (
    bucket_id = 'wedding-documents'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'documents.manage')
  );
create policy wedding_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wedding-documents'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'documents.manage')
  );

drop policy if exists wedding_covers_insert_writer on storage.objects;
drop policy if exists wedding_covers_update_writer on storage.objects;
drop policy if exists wedding_covers_delete_writer on storage.objects;

create policy wedding_covers_insert_writer on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wedding-covers'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'wedding.settings.manage')
  );
create policy wedding_covers_update_writer on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wedding-covers'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'wedding.settings.manage')
  )
  with check (
    bucket_id = 'wedding-covers'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'wedding.settings.manage')
  );
create policy wedding_covers_delete_writer on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wedding-covers'
    and private.has_wedding_permission((storage.foldername(name))[1]::uuid, 'wedding.settings.manage')
  );
