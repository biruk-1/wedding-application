-- Planning Team, Milestone 5 (1 of 2): permission RPCs, D9 backfill, budget summary,
-- wedding settings RPC, budget item_kind, guest invite auth switch.
-- RLS policy replacement is the following migration.

-- ---------------------------------------------------------------------------
-- D8: distinguish allocations from expenses on budget_items
-- ---------------------------------------------------------------------------

alter table public.budget_items
  add column if not exists item_kind text;

update public.budget_items
set item_kind = 'allocation'
where item_kind is null
  and wedding_vendor_id is null
  and booking_id is null
  and committed_amount is null
  and not exists (
    select 1 from public.expense_payments p where p.budget_item_id = budget_items.id
  );

update public.budget_items
set item_kind = 'expense'
where item_kind is null;

alter table public.budget_items
  alter column item_kind set default 'expense',
  alter column item_kind set not null;

alter table public.budget_items drop constraint if exists budget_items_item_kind_check;
alter table public.budget_items
  add constraint budget_items_item_kind_check
  check (item_kind in ('allocation', 'expense'));

-- create_wedding onboarding rows are category allocations (same body as before + item_kind).
create or replace function public.create_wedding(
  p_title text,
  p_partner_one_name text default null,
  p_partner_two_name text default null,
  p_wedding_date date default null,
  p_city text default null,
  p_country_code char default 'ET',
  p_timezone text default 'Africa/Addis_Ababa',
  p_style text default null,
  p_currency_code char default 'ETB',
  p_estimated_guest_count integer default null,
  p_celebration_kind text default 'wedding',
  p_total_budget numeric default 0,
  p_budget_allocations jsonb default '[]'::jsonb
)
returns public.weddings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wedding public.weddings;
  v_invalid_allocation boolean;
  v_allocation_total numeric;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_title is null or length(pg_catalog.btrim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  if p_celebration_kind is null or p_celebration_kind not in (
    'wedding', 'shemgelena', 'qelekel', 'baby_shower', 'birthday',
    'anniversary', 'graduation', 'other'
  ) then
    raise exception 'invalid celebration_kind';
  end if;

  if p_celebration_kind = 'wedding' and (
    p_partner_one_name is null
    or length(pg_catalog.btrim(p_partner_one_name)) = 0
    or p_partner_two_name is null
    or length(pg_catalog.btrim(p_partner_two_name)) = 0
  ) then
    raise exception 'partner names are required for weddings';
  end if;

  if p_total_budget is null or p_total_budget < 0 then
    raise exception 'total_budget must be nonnegative';
  end if;

  if p_estimated_guest_count is not null and p_estimated_guest_count < 0 then
    raise exception 'estimated_guest_count must be nonnegative';
  end if;

  if p_budget_allocations is null
    or pg_catalog.jsonb_typeof(p_budget_allocations) <> 'array' then
    raise exception 'budget_allocations must be an array';
  end if;

  select coalesce(
    pg_catalog.bool_or(
      pg_catalog.jsonb_typeof(allocation) <> 'object'
      or pg_catalog.jsonb_typeof(allocation -> 'category_slug') <> 'string'
      or length(pg_catalog.btrim(allocation ->> 'category_slug')) = 0
      or pg_catalog.jsonb_typeof(allocation -> 'amount') <> 'number'
      or (allocation ->> 'amount')::numeric < 0
    ),
    false
  )
  into v_invalid_allocation
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation);

  if v_invalid_allocation then
    raise exception 'each budget allocation requires a valid category_slug and nonnegative amount';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation)
    left join public.budget_categories category
      on category.slug = allocation ->> 'category_slug'
    where category.id is null
  ) then
    raise exception 'budget allocation contains an invalid category_slug';
  end if;

  select coalesce(pg_catalog.sum((allocation ->> 'amount')::numeric), 0)
  into v_allocation_total
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation);

  if v_allocation_total > p_total_budget then
    raise exception 'budget allocation total cannot exceed total_budget';
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  insert into public.weddings (
    created_by, title, partner_one_name, partner_two_name, wedding_date,
    city, country_code, timezone, style, currency_code, estimated_guest_count, celebration_kind
  ) values (
    v_uid,
    pg_catalog.btrim(p_title),
    nullif(pg_catalog.btrim(p_partner_one_name), ''),
    nullif(pg_catalog.btrim(p_partner_two_name), ''),
    p_wedding_date,
    nullif(pg_catalog.btrim(p_city), ''),
    coalesce(p_country_code, 'ET'),
    coalesce(p_timezone, 'Africa/Addis_Ababa'),
    p_style,
    coalesce(p_currency_code, 'ETB'),
    p_estimated_guest_count,
    p_celebration_kind
  )
  returning * into v_wedding;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_wedding.id, v_uid, 'owner');

  insert into public.wedding_budgets (wedding_id, total_budget, currency_code)
  values (v_wedding.id, p_total_budget, v_wedding.currency_code);

  insert into public.budget_items (
    wedding_id, category_id, label, estimated_amount, item_kind
  )
  select
    v_wedding.id,
    category.id,
    category.name_en,
    (allocation ->> 'amount')::numeric,
    'allocation'
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation)
  join public.budget_categories category
    on category.slug = allocation ->> 'category_slug';

  return v_wedding;
end;
$$;

revoke all on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
) from public, anon;
grant execute on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D9 backfill: existing non-owners get their role template permissions.
-- Legacy viewers historically could read everything; grant all *.view keys plus
-- guests.contacts.view so the RLS switch does not lock them out of prior reads.
-- ---------------------------------------------------------------------------

insert into public.wedding_member_permissions (wedding_id, user_id, permission)
select m.wedding_id, m.user_id, t.permission
from public.wedding_members m
join public.wedding_role_templates t on t.template = m.role
where m.role <> 'owner'
  and m.role <> 'viewer'
on conflict do nothing;

insert into public.wedding_member_permissions (wedding_id, user_id, permission)
select m.wedding_id, m.user_id, c.key
from public.wedding_members m
cross join public.wedding_permission_catalog c
where m.role = 'viewer'
  and c.is_grantable
  and (
    c.key like '%.view'
    or c.key = 'guests.contacts.view'
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- set_member_role_template / set_member_permissions
-- ---------------------------------------------------------------------------

create or replace function public.set_member_role_template(
  p_wedding_id uuid,
  p_user_id uuid,
  p_template text,
  p_reset_permissions boolean default true
)
returns public.wedding_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.wedding_members;
  v_template text := nullif(btrim(p_template), '');
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can change membership roles';
  end if;
  if v_template is null or v_template not in (
    'partner', 'planner', 'collaborator', 'viewer',
    'co_host', 'family_coordinator', 'task_manager', 'custom'
  ) then
    raise exception 'invalid role';
  end if;
  if p_user_id = v_uid then
    raise exception 'owners cannot change their own role with this action';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  select * into v_member
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'member not found';
  end if;
  if v_member.role = 'owner' then
    raise exception 'ownership can only change through the ownership workflow';
  end if;

  update public.wedding_members m
  set role = v_template
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  returning * into v_member;

  if coalesce(p_reset_permissions, true) then
    delete from public.wedding_member_permissions p
    where p.wedding_id = p_wedding_id and p.user_id = p_user_id;

    insert into public.wedding_member_permissions (wedding_id, user_id, permission, granted_by)
    select p_wedding_id, p_user_id, t.permission, v_uid
    from public.wedding_role_templates t
    where t.template = v_template;
  end if;

  perform private.log_activity(
    p_wedding_id,
    'member.role_changed',
    'member',
    p_user_id,
    'team.view',
    jsonb_build_object('role', v_template, 'reset_permissions', coalesce(p_reset_permissions, true))
  );

  return v_member;
end;
$$;

create or replace function public.set_member_permissions(
  p_wedding_id uuid,
  p_user_id uuid,
  p_permissions text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_expanded text[];
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can manage permissions';
  end if;
  if p_user_id = v_uid then
    raise exception 'owners already hold every permission';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  select m.role into v_role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'member not found';
  end if;
  if v_role = 'owner' then
    raise exception 'owners already hold every permission';
  end if;

  v_expanded := private.expand_permissions(coalesce(p_permissions, '{}'));

  delete from public.wedding_member_permissions p
  where p.wedding_id = p_wedding_id
    and p.user_id = p_user_id
    and not (p.permission = any (v_expanded));

  insert into public.wedding_member_permissions (wedding_id, user_id, permission, granted_by)
  select p_wedding_id, p_user_id, perm, v_uid
  from unnest(v_expanded) as perm
  on conflict do nothing;

  select coalesce(jsonb_agg(p.permission order by c.sort_order), '[]'::jsonb)
  into v_result
  from public.wedding_member_permissions p
  join public.wedding_permission_catalog c on c.key = p.permission
  where p.wedding_id = p_wedding_id and p.user_id = p_user_id;

  perform private.log_activity(
    p_wedding_id,
    'member.permissions_changed',
    'member',
    p_user_id,
    'team.view',
    jsonb_build_object('permissions', v_result)
  );

  return v_result;
end;
$$;

revoke all on function public.set_member_role_template(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.set_member_permissions(uuid, uuid, text[]) from public, anon;
grant execute on function public.set_member_role_template(uuid, uuid, text, boolean)
  to authenticated, service_role;
grant execute on function public.set_member_permissions(uuid, uuid, text[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Wedding settings: owner-reserved; replace direct table updates for clients
-- ---------------------------------------------------------------------------

create or replace function public.update_wedding_settings(
  p_wedding_id uuid,
  p_title text default null,
  p_partner_one_name text default null,
  p_partner_two_name text default null,
  p_wedding_date date default null,
  p_city text default null,
  p_style text default null,
  p_currency_code char(3) default null,
  p_status text default null,
  p_cover_image_url text default null,
  p_estimated_guest_count integer default null
)
returns public.weddings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wedding public.weddings;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.has_wedding_permission(p_wedding_id, 'wedding.settings.manage') then
    raise exception 'only wedding owners can change wedding settings';
  end if;

  update public.weddings w
  set
    title = case
      when p_title is null then w.title
      when length(btrim(p_title)) = 0 then w.title
      else btrim(p_title)
    end,
    partner_one_name = case
      when p_partner_one_name is null then w.partner_one_name
      else nullif(btrim(p_partner_one_name), '')
    end,
    partner_two_name = case
      when p_partner_two_name is null then w.partner_two_name
      else nullif(btrim(p_partner_two_name), '')
    end,
    wedding_date = coalesce(p_wedding_date, w.wedding_date),
    city = case
      when p_city is null then w.city
      else nullif(btrim(p_city), '')
    end,
    style = coalesce(p_style, w.style),
    currency_code = coalesce(p_currency_code, w.currency_code),
    status = coalesce(p_status, w.status),
    cover_image_url = coalesce(p_cover_image_url, w.cover_image_url),
    estimated_guest_count = coalesce(p_estimated_guest_count, w.estimated_guest_count)
  where w.id = p_wedding_id
  returning * into v_wedding;

  if not found then
    raise exception 'wedding not found';
  end if;

  perform private.log_activity(
    p_wedding_id,
    'wedding.settings_updated',
    'wedding',
    p_wedding_id,
    'wedding.settings.manage',
    '{}'::jsonb
  );

  return v_wedding;
end;
$$;

revoke all on function public.update_wedding_settings(
  uuid, text, text, text, date, text, text, char, text, text, integer
) from public, anon;
grant execute on function public.update_wedding_settings(
  uuid, text, text, text, date, text, text, char, text, text, integer
) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Budget summary for budget.view without expense line access
-- ---------------------------------------------------------------------------

create or replace function public.get_budget_summary(p_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_budget public.wedding_budgets;
  v_categories jsonb;
  v_spent numeric;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.has_wedding_permission(p_wedding_id, 'budget.view') then
    raise exception 'budget access denied' using errcode = '42501';
  end if;

  select * into v_budget
  from public.wedding_budgets b
  where b.wedding_id = p_wedding_id;

  if not found then
    raise exception 'budget not found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category_id', c.id,
        'category_slug', c.slug,
        'category_name', c.name_en,
        'allocated', coalesce(a.allocated, 0),
        'estimated_expenses', coalesce(e.estimated, 0),
        'committed_expenses', coalesce(e.committed, 0)
      )
      order by c.name_en
    ),
    '[]'::jsonb
  )
  into v_categories
  from public.budget_categories c
  left join lateral (
    select sum(i.estimated_amount) as allocated
    from public.budget_items i
    where i.wedding_id = p_wedding_id
      and i.category_id = c.id
      and i.item_kind = 'allocation'
  ) a on true
  left join lateral (
    select
      sum(i.estimated_amount) as estimated,
      sum(coalesce(i.committed_amount, 0)) as committed
    from public.budget_items i
    where i.wedding_id = p_wedding_id
      and i.category_id = c.id
      and i.item_kind = 'expense'
  ) e on true
  where coalesce(a.allocated, 0) > 0
     or coalesce(e.estimated, 0) > 0
     or coalesce(e.committed, 0) > 0;

  select coalesce(sum(p.amount), 0) into v_spent
  from public.expense_payments p
  join public.budget_items i on i.id = p.budget_item_id
  where i.wedding_id = p_wedding_id;

  return jsonb_build_object(
    'wedding_id', p_wedding_id,
    'currency_code', v_budget.currency_code,
    'total_budget', v_budget.total_budget,
    'total_paid', v_spent,
    'categories', v_categories
  );
end;
$$;

revoke all on function public.get_budget_summary(uuid) from public, anon;
grant execute on function public.get_budget_summary(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- list_team_members: require team.view (owners always have it; backfill grants it)
-- ---------------------------------------------------------------------------

create or replace function public.list_team_members(p_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_owner boolean;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.has_wedding_permission(p_wedding_id, 'team.view') then
    raise exception 'not a member of this wedding' using errcode = '42501';
  end if;

  v_is_owner := private.is_wedding_owner(p_wedding_id);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', m.user_id,
        'role', m.role,
        'joined_at', m.joined_at,
        'invited_by', m.invited_by,
        'display_name', coalesce(nullif(btrim(p.display_name), ''), 'Member'),
        'avatar_url', p.avatar_url,
        'phone', case when v_is_owner then p.phone else null end,
        'is_owner', m.role = 'owner',
        'is_self', m.user_id = v_uid
      )
      order by
        case when m.role = 'owner' then 0 else 1 end,
        lower(coalesce(nullif(btrim(p.display_name), ''), 'Member')),
        m.joined_at,
        m.user_id
    ),
    '[]'::jsonb
  )
  into v_result
  from public.wedding_members m
  join public.profiles p on p.id = m.user_id
  where m.wedding_id = p_wedding_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guest invitation RPCs: switch authorization to guests.send_invitations
-- (bodies otherwise match the prior RPCs).
-- ---------------------------------------------------------------------------

create or replace function private.can_send_guest_invitations(
  p_wedding_id uuid,
  p_group_id uuid default null,
  p_guest_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_wedding_permission(p_wedding_id, 'guests.send_invitations')
    or (
      p_group_id is not null
      and private.can_access_guest_group(p_wedding_id, p_group_id, 'send_invitations')
    )
    or (
      p_guest_id is not null
      and exists (
        select 1 from public.guests g
        where g.id = p_guest_id
          and g.wedding_id = p_wedding_id
          and private.can_access_guest_group(p_wedding_id, g.group_id, 'send_invitations')
      )
    );
$$;

revoke all on function private.can_send_guest_invitations(uuid, uuid, uuid)
  from public, anon;
grant execute on function private.can_send_guest_invitations(uuid, uuid, uuid)
  to authenticated, service_role;

create or replace function public.create_guest_invitation(
  p_wedding_id uuid,
  p_guest_id uuid default null,
  p_group_id uuid default null,
  p_design_id uuid default null,
  p_event_ids uuid[] default null,
  p_delivery_channel text default 'link'
)
returns table (invitation_id uuid, raw_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.can_send_guest_invitations(p_wedding_id, p_group_id, p_guest_id) then
    raise exception 'not authorized to create invitations for this wedding';
  end if;
  if p_guest_id is null and p_group_id is null then
    raise exception 'guest_id or group_id is required';
  end if;
  if p_delivery_channel is not null
     and p_delivery_channel not in ('link', 'sms', 'whatsapp', 'email', 'print', 'other') then
    raise exception 'invalid delivery_channel';
  end if;

  if p_guest_id is not null then
    if not exists (
      select 1 from public.guests g
      where g.id = p_guest_id and g.wedding_id = p_wedding_id
    ) then
      raise exception 'guest does not belong to this wedding';
    end if;
  end if;

  if p_group_id is not null then
    if not exists (
      select 1 from public.guest_groups gg
      where gg.id = p_group_id and gg.wedding_id = p_wedding_id
    ) then
      raise exception 'group does not belong to this wedding';
    end if;
  end if;

  if p_design_id is not null then
    if not exists (
      select 1 from public.invitation_designs d
      where d.id = p_design_id and d.wedding_id = p_wedding_id
    ) then
      raise exception 'design does not belong to this wedding';
    end if;
  end if;

  if p_event_ids is not null then
    foreach v_event_id in array p_event_ids loop
      if not exists (
        select 1 from public.wedding_events e
        where e.id = v_event_id and e.wedding_id = p_wedding_id
      ) then
        raise exception 'event does not belong to this wedding';
      end if;
    end loop;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  insert into public.invitations (
    wedding_id, guest_id, group_id, design_id, token_hash, delivery_channel, status
  ) values (
    p_wedding_id, p_guest_id, p_group_id, p_design_id, v_hash,
    coalesce(p_delivery_channel, 'link'), 'ready'
  )
  returning id into v_id;

  if p_event_ids is not null then
    foreach v_event_id in array p_event_ids loop
      insert into public.invitation_events (invitation_id, event_id)
      values (v_id, v_event_id)
      on conflict do nothing;
    end loop;
  end if;

  invitation_id := v_id;
  raw_token := v_token;
  return next;
end;
$$;

create or replace function public.mark_guest_invitation_sent(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_invite from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if not private.can_send_guest_invitations(
    v_invite.wedding_id, v_invite.group_id, v_invite.guest_id
  ) then
    raise exception 'not authorized';
  end if;
  if v_invite.status = 'cancelled' then
    raise exception 'invitation is cancelled';
  end if;

  update public.invitations
  set status = case
        when status in ('draft', 'ready') then 'sent'
        else status
      end,
      sent_at = coalesce(sent_at, now())
  where id = p_invitation_id
  returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'wedding_id', v_invite.wedding_id,
    'guest_id', v_invite.guest_id,
    'group_id', v_invite.group_id,
    'design_id', v_invite.design_id,
    'delivery_channel', v_invite.delivery_channel,
    'status', v_invite.status,
    'sent_at', v_invite.sent_at,
    'delivered_at', v_invite.delivered_at,
    'opened_at', v_invite.opened_at,
    'created_at', v_invite.created_at
  );
end;
$$;

revoke all on function public.create_guest_invitation(uuid, uuid, uuid, uuid, uuid[], text)
  from public, anon;
revoke all on function public.mark_guest_invitation_sent(uuid) from public, anon;
grant execute on function public.create_guest_invitation(uuid, uuid, uuid, uuid, uuid[], text)
  to authenticated, service_role;
grant execute on function public.mark_guest_invitation_sent(uuid)
  to authenticated, service_role;
