-- Planning Team, Milestone 2 (2 of 3): collaboration foundation.
-- Equal ownership invariants, permission catalog and role templates, per-member permissions,
-- guest group coordinators, permission helpers and the caller's access summary RPC.
-- Feature-table RLS keeps using can_write_wedding until Milestone 5 switches it to these helpers.
-- See docs/planning-team/05-permission-matrix.md and 06-proposed-database-architecture.md.

-- ---------------------------------------------------------------------------
-- Preflight: refuse to apply when existing data breaks the ownership invariant.
-- ---------------------------------------------------------------------------

do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.weddings w
  where (
    select count(*) from public.wedding_members m
    where m.wedding_id = w.id and m.role = 'owner'
  ) not between 1 and 2;

  if v_bad > 0 then
    raise exception 'team_foundation preflight: % wedding(s) do not have 1 or 2 owners; resolve before applying', v_bad;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Role values: superset of the original five (decisions D1, D2). New roles are labels for
-- role templates; authority comes from ownership and wedding_member_permissions.
-- ---------------------------------------------------------------------------

alter table public.wedding_members drop constraint wedding_members_role_check;
alter table public.wedding_members add constraint wedding_members_role_check check (
  role in (
    'owner', 'partner', 'planner', 'collaborator', 'viewer',
    'co_host', 'family_coordinator', 'task_manager', 'custom'
  )
);

alter table public.wedding_invites drop constraint wedding_invites_role_check;
alter table public.wedding_invites add constraint wedding_invites_role_check check (
  role in (
    'partner', 'planner', 'collaborator', 'viewer',
    'co_host', 'family_coordinator', 'task_manager', 'custom'
  )
);

alter table public.wedding_members
  add column invited_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz not null default now();

create trigger wedding_members_set_updated_at
  before update on public.wedding_members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership invariants: every wedding has one or two owners, membership keys never move,
-- and API callers cannot create or remove ownership with plain writes.
-- Ownership RPCs (Milestones 4 and 5) set kiburan.allow_owner_change = 'on' for their transaction.
-- ---------------------------------------------------------------------------

create or replace function private.guard_wedding_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trusted boolean := auth.uid() is null
    or current_setting('kiburan.allow_owner_change', true) = 'on';
begin
  if tg_op = 'DELETE' then
    -- A wedding delete cascades to its memberships; the wedding row is already gone.
    if old.role <> 'owner'
      or v_trusted
      or not exists (select 1 from public.weddings w where w.id = old.wedding_id) then
      return old;
    end if;
    raise exception 'ownership can only change through the ownership workflow' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.wedding_id <> old.wedding_id or new.user_id <> old.user_id then
      raise exception 'membership wedding and user cannot change' using errcode = '42501';
    end if;
    if (new.role = 'owner') = (old.role = 'owner') then
      return new;
    end if;
  elsif new.role <> 'owner' then
    return new;
  end if;

  if v_trusted then
    return new;
  end if;

  -- create_wedding inserts the creator as the first owner.
  if tg_op = 'INSERT'
    and exists (
      select 1 from public.weddings w
      where w.id = new.wedding_id and w.created_by = new.user_id
    )
    and not exists (
      select 1 from public.wedding_members m
      where m.wedding_id = new.wedding_id and m.role = 'owner'
    ) then
    return new;
  end if;

  raise exception 'ownership can only change through the ownership workflow' using errcode = '42501';
end;
$$;

revoke all on function private.guard_wedding_member_change() from public, anon, authenticated;

create trigger wedding_members_guard_change
  before insert or update or delete on public.wedding_members
  for each row execute function private.guard_wedding_member_change();

create or replace function private.enforce_wedding_owner_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
  v_owner_count integer;
begin
  if not (
    (tg_op <> 'DELETE' and new.role = 'owner')
    or (tg_op <> 'INSERT' and old.role = 'owner')
  ) then
    return null;
  end if;

  v_wedding_id := case when tg_op = 'DELETE' then old.wedding_id else new.wedding_id end;

  perform 1 from public.weddings w where w.id = v_wedding_id for update;
  if not found then
    -- The wedding itself is being deleted; its memberships cascade away.
    return null;
  end if;

  select count(*) into v_owner_count
  from public.wedding_members m
  where m.wedding_id = v_wedding_id and m.role = 'owner';

  if v_owner_count < 1 then
    raise exception 'a wedding must keep at least one owner' using errcode = '23514';
  end if;
  if v_owner_count > 2 then
    raise exception 'a wedding can have at most two owners' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke all on function private.enforce_wedding_owner_count() from public, anon, authenticated;

create trigger wedding_members_owner_count
  after insert or update of role or delete on public.wedding_members
  for each row execute function private.enforce_wedding_owner_count();

-- ---------------------------------------------------------------------------
-- Permission catalog and role templates (reference data, read-only to clients).
-- ---------------------------------------------------------------------------

create table public.wedding_permission_catalog (
  key text primary key check (key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  category text not null check (
    category in ('team', 'wedding', 'activity', 'guests', 'tasks', 'vendors', 'budget', 'timeline', 'documents')
  ),
  label text not null,
  description text not null,
  is_grantable boolean not null,
  is_financial boolean not null default false,
  requires text[] not null default '{}',
  sort_order integer not null
);

comment on table public.wedding_permission_catalog is
  'Planning Team permission keys. Non-grantable keys are reserved for wedding owners.';

insert into public.wedding_permission_catalog
  (key, category, label, description, is_grantable, is_financial, requires, sort_order)
values
  ('team.view', 'team', 'View team', 'See Planning Team members and their roles.', true, false, '{}', 10),
  ('team.invite', 'team', 'Invite members', 'Create, resend and revoke Planning Team invitations.', false, false, '{}', 20),
  ('team.members.manage', 'team', 'Manage members', 'Change member roles and remove members.', false, false, '{}', 30),
  ('team.permissions.manage', 'team', 'Manage permissions', 'Edit member permissions and guest group coordinators.', false, false, '{}', 40),
  ('wedding.settings.manage', 'wedding', 'Manage wedding settings', 'Edit title, date, names, status, currency, style and cover.', false, false, '{}', 50),
  ('activity.view', 'activity', 'View activity', 'See the activity history for areas the member can already see.', true, false, '{}', 60),
  ('guests.view', 'guests', 'View guests', 'See every guest and group, including RSVPs.', true, false, '{}', 100),
  ('guests.contacts.view', 'guests', 'View guest contacts', 'See guest phone, email, dietary notes and notes.', true, false, '{guests.view}', 110),
  ('guests.create', 'guests', 'Add guests', 'Add guests to any group.', true, false, '{guests.view}', 120),
  ('guests.update', 'guests', 'Edit guests', 'Edit any guest and their RSVPs.', true, false, '{guests.view}', 130),
  ('guests.delete', 'guests', 'Delete guests', 'Delete any guest.', true, false, '{guests.view}', 140),
  ('guests.manage_all', 'guests', 'Manage all guests', 'Manage every guest, group and seating arrangement.', true, false,
    '{guests.view,guests.contacts.view,guests.create,guests.update,guests.delete}', 150),
  ('guests.send_invitations', 'guests', 'Send guest invitations', 'Create, send and cancel guest invitations.', true, false, '{guests.view}', 160),
  ('tasks.view', 'tasks', 'View tasks', 'See all tasks, assignees and comments.', true, false, '{}', 200),
  ('tasks.create', 'tasks', 'Create tasks', 'Create tasks, including from templates.', true, false, '{tasks.view}', 210),
  ('tasks.update', 'tasks', 'Edit tasks', 'Edit any task.', true, false, '{tasks.view}', 220),
  ('tasks.assign', 'tasks', 'Assign tasks', 'Add and remove task assignees.', true, false, '{tasks.view}', 230),
  ('tasks.comment', 'tasks', 'Comment on tasks', 'Comment on tasks the member can see.', true, false, '{tasks.view}', 240),
  ('tasks.delete', 'tasks', 'Delete tasks', 'Delete tasks.', true, false, '{tasks.view}', 250),
  ('vendors.view', 'vendors', 'View vendors', 'See saved and booked vendors and their status.', true, false, '{}', 300),
  ('vendors.manage', 'vendors', 'Manage vendors', 'Shortlist, update and remove vendors; manage bookings.', true, false, '{vendors.view}', 310),
  ('vendors.inquiries.manage', 'vendors', 'Manage vendor inquiries', 'Send and follow up vendor inquiries.', true, false, '{vendors.view}', 320),
  ('budget.view', 'budget', 'View budget totals', 'See the total budget and category totals.', true, true, '{}', 400),
  ('budget.expenses.view', 'budget', 'View expenses', 'See individual expenses and booking amounts.', true, true, '{budget.view}', 410),
  ('budget.payments.view', 'budget', 'View payments', 'See payments, methods, references and receipts.', true, true, '{budget.expenses.view}', 420),
  ('budget.expenses.create', 'budget', 'Add expenses', 'Add expense lines.', true, true, '{budget.expenses.view}', 430),
  ('budget.expenses.update', 'budget', 'Edit expenses', 'Edit expenses and record payments.', true, true, '{budget.expenses.view}', 440),
  ('budget.expenses.delete', 'budget', 'Delete expenses', 'Delete expenses and their payments.', true, true, '{budget.expenses.view}', 450),
  ('budget.manage', 'budget', 'Manage budget', 'Change the total budget and category allocations.', true, true, '{budget.view}', 460),
  ('timeline.view', 'timeline', 'View timeline', 'See events, the run of show and the calendar.', true, false, '{}', 500),
  ('timeline.manage', 'timeline', 'Manage timeline', 'Create, edit and delete events and timeline items.', true, false, '{timeline.view}', 510),
  ('documents.view', 'documents', 'View documents', 'See non-financial wedding documents.', true, false, '{}', 600),
  ('documents.manage', 'documents', 'Manage documents', 'Upload, rename and delete documents.', true, false, '{documents.view}', 610);

create table public.wedding_role_templates (
  template text not null check (
    template in (
      'partner', 'planner', 'collaborator', 'viewer',
      'co_host', 'family_coordinator', 'task_manager', 'custom'
    )
  ),
  permission text not null references public.wedding_permission_catalog (key) on delete cascade,
  primary key (template, permission)
);

comment on table public.wedding_role_templates is
  'Default permission sets per non-owner role. Templates are starting points; stored member permissions are authoritative.';

insert into public.wedding_role_templates (template, permission)
select t.template, p.permission
from (values
  ('co_host', array[
    'team.view', 'activity.view',
    'guests.view', 'guests.contacts.view', 'guests.create', 'guests.update', 'guests.send_invitations',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.comment',
    'vendors.view', 'vendors.manage',
    'timeline.view', 'timeline.manage',
    'documents.view', 'documents.manage'
  ]),
  ('planner', array[
    'team.view', 'activity.view',
    'guests.view', 'guests.contacts.view', 'guests.create', 'guests.update', 'guests.delete',
    'guests.manage_all', 'guests.send_invitations',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.comment', 'tasks.delete',
    'vendors.view', 'vendors.manage', 'vendors.inquiries.manage',
    'timeline.view', 'timeline.manage',
    'documents.view', 'documents.manage'
  ]),
  ('family_coordinator', array['team.view', 'tasks.view', 'tasks.comment', 'timeline.view']),
  ('task_manager', array[
    'team.view',
    'tasks.view', 'tasks.create', 'tasks.update', 'tasks.assign', 'tasks.comment', 'tasks.delete',
    'vendors.view', 'timeline.view', 'documents.view'
  ]),
  ('viewer', array['team.view', 'tasks.view', 'vendors.view', 'timeline.view']),
  ('custom', array['team.view'])
) as t (template, permissions)
cross join lateral unnest(t.permissions) as p (permission);

-- Legacy roles keep their pre-Planning-Team access (decision D9): every grantable permission.
insert into public.wedding_role_templates (template, permission)
select r.template, c.key
from (values ('partner'), ('collaborator')) as r (template)
cross join public.wedding_permission_catalog c
where c.is_grantable;

do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from public.wedding_role_templates t
  join public.wedding_permission_catalog c on c.key = t.permission
  where not c.is_grantable
    or exists (
      select 1 from unnest(c.requires) as r (key)
      where not exists (
        select 1 from public.wedding_role_templates t2
        where t2.template = t.template and t2.permission = r.key
      )
    );
  if v_bad > 0 then
    raise exception 'team_foundation: % template permission(s) are reserved or missing prerequisites', v_bad;
  end if;

  select count(*) into v_bad
  from public.wedding_permission_catalog c, unnest(c.requires) as r (key)
  where not exists (select 1 from public.wedding_permission_catalog c2 where c2.key = r.key);
  if v_bad > 0 then
    raise exception 'team_foundation: % catalog prerequisite(s) reference unknown keys', v_bad;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-member permissions. Owners never have rows: ownership implies every permission.
-- ---------------------------------------------------------------------------

create table public.wedding_member_permissions (
  wedding_id uuid not null,
  user_id uuid not null,
  permission text not null references public.wedding_permission_catalog (key),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (wedding_id, user_id, permission),
  foreign key (wedding_id, user_id)
    references public.wedding_members (wedding_id, user_id) on delete cascade
);

comment on table public.wedding_member_permissions is
  'Effective permissions of non-owner members. Written only by owner RPCs (Milestone 5).';

create or replace function private.validate_member_permission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.wedding_permission_catalog c
    where c.key = new.permission and c.is_grantable
  ) then
    raise exception 'permission % is not grantable', new.permission using errcode = '42501';
  end if;
  if exists (
    select 1 from public.wedding_members m
    where m.wedding_id = new.wedding_id and m.user_id = new.user_id and m.role = 'owner'
  ) then
    raise exception 'owners already hold every permission' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_member_permission() from public, anon, authenticated;

create trigger wedding_member_permissions_validate
  before insert or update on public.wedding_member_permissions
  for each row execute function private.validate_member_permission();

create or replace function private.clear_owner_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.wedding_member_permissions p
  where p.wedding_id = new.wedding_id and p.user_id = new.user_id;
  return null;
end;
$$;

revoke all on function private.clear_owner_permissions() from public, anon, authenticated;

create trigger wedding_members_clear_owner_permissions
  after update of role on public.wedding_members
  for each row
  when (new.role = 'owner' and old.role <> 'owner')
  execute function private.clear_owner_permissions();

-- ---------------------------------------------------------------------------
-- Guest group coordinators: group-scoped guest access for specific members.
-- ---------------------------------------------------------------------------

alter table public.guest_groups
  add constraint guest_groups_id_wedding_key unique (id, wedding_id);

create table public.guest_group_coordinators (
  wedding_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  can_delete boolean not null default false,
  can_send_invitations boolean not null default true,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (group_id, user_id),
  foreign key (group_id, wedding_id)
    references public.guest_groups (id, wedding_id) on delete cascade,
  foreign key (wedding_id, user_id)
    references public.wedding_members (wedding_id, user_id) on delete cascade
);

create index guest_group_coordinators_member_idx
  on public.guest_group_coordinators (wedding_id, user_id);

comment on table public.guest_group_coordinators is
  'Members who manage guests only inside specific guest groups. Written only by owner RPCs (Milestone 5).';

-- ---------------------------------------------------------------------------
-- Permission helpers. Same conventions as the existing private helpers.
-- ---------------------------------------------------------------------------

create or replace function private.has_wedding_permission(p_wedding_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.wedding_permission_catalog c where c.key = p_permission
    )
    and (
      exists (
        select 1 from public.wedding_members m
        where m.wedding_id = p_wedding_id
          and m.user_id = (select auth.uid())
          and m.role = 'owner'
      )
      or exists (
        select 1 from public.wedding_member_permissions p
        where p.wedding_id = p_wedding_id
          and p.user_id = (select auth.uid())
          and p.permission = p_permission
      )
    );
$$;

create or replace function private.can_access_guest_group(
  p_wedding_id uuid,
  p_group_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    case p_capability
      when 'view' then private.has_wedding_permission(p_wedding_id, 'guests.view')
      when 'create' then private.has_wedding_permission(p_wedding_id, 'guests.create')
      when 'update' then private.has_wedding_permission(p_wedding_id, 'guests.update')
      when 'delete' then private.has_wedding_permission(p_wedding_id, 'guests.delete')
      when 'send_invitations' then private.has_wedding_permission(p_wedding_id, 'guests.send_invitations')
      else false
    end
    or (
      p_group_id is not null
      and exists (
        select 1 from public.guest_group_coordinators c
        where c.group_id = p_group_id
          and c.wedding_id = p_wedding_id
          and c.user_id = (select auth.uid())
          and case p_capability
            when 'view' then true
            when 'create' then true
            when 'update' then true
            when 'delete' then c.can_delete
            when 'send_invitations' then c.can_send_invitations
            else false
          end
      )
    );
$$;

revoke all on function private.has_wedding_permission(uuid, text) from public, anon;
revoke all on function private.can_access_guest_group(uuid, uuid, text) from public, anon;
grant execute on function private.has_wedding_permission(uuid, text) to authenticated, service_role;
grant execute on function private.can_access_guest_group(uuid, uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: reference data is readable by signed-in users; member data is visible to the member
-- themselves and to owners. No client writes: Milestone 5 adds owner RPCs.
-- ---------------------------------------------------------------------------

alter table public.wedding_permission_catalog enable row level security;
alter table public.wedding_role_templates enable row level security;
alter table public.wedding_member_permissions enable row level security;
alter table public.guest_group_coordinators enable row level security;

revoke all on table public.wedding_permission_catalog from anon, authenticated;
revoke all on table public.wedding_role_templates from anon, authenticated;
revoke all on table public.wedding_member_permissions from anon, authenticated;
revoke all on table public.guest_group_coordinators from anon, authenticated;

grant select on table public.wedding_permission_catalog to authenticated;
grant select on table public.wedding_role_templates to authenticated;
grant select on table public.wedding_member_permissions to authenticated;
grant select on table public.guest_group_coordinators to authenticated;

create policy wedding_permission_catalog_select on public.wedding_permission_catalog
  for select to authenticated
  using (true);

create policy wedding_role_templates_select on public.wedding_role_templates
  for select to authenticated
  using (true);

create policy wedding_member_permissions_select on public.wedding_member_permissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_wedding_owner(wedding_id)
  );

create policy guest_group_coordinators_select on public.guest_group_coordinators
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_wedding_owner(wedding_id)
    or private.has_wedding_permission(wedding_id, 'guests.manage_all')
  );

-- ---------------------------------------------------------------------------
-- Caller's effective access, for display only. Enforcement stays in RLS and RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.get_my_wedding_access(p_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_permissions jsonb;
  v_groups jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select m.role into v_role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = v_uid;

  if v_role is null then
    raise exception 'not a member of this wedding' using errcode = '42501';
  end if;

  if v_role = 'owner' then
    select coalesce(jsonb_agg(c.key order by c.sort_order), '[]'::jsonb)
    into v_permissions
    from public.wedding_permission_catalog c;
  else
    select coalesce(jsonb_agg(p.permission order by c.sort_order), '[]'::jsonb)
    into v_permissions
    from public.wedding_member_permissions p
    join public.wedding_permission_catalog c on c.key = p.permission
    where p.wedding_id = p_wedding_id and p.user_id = v_uid;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'group_id', c.group_id,
        'can_delete', c.can_delete,
        'can_send_invitations', c.can_send_invitations
      )
      order by c.assigned_at, c.group_id
    ),
    '[]'::jsonb
  )
  into v_groups
  from public.guest_group_coordinators c
  where c.wedding_id = p_wedding_id and c.user_id = v_uid;

  return jsonb_build_object(
    'wedding_id', p_wedding_id,
    'role', v_role,
    'is_owner', v_role = 'owner',
    'permissions', v_permissions,
    'coordinated_groups', v_groups
  );
end;
$$;

revoke all on function public.get_my_wedding_access(uuid) from public, anon;
grant execute on function public.get_my_wedding_access(uuid) to authenticated, service_role;
