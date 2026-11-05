-- Planning Team, Milestone 6: shared guest management.
-- Coordinator assign/unassign, delete RPCs, contact privacy (D7), family groups (D10),
-- guest directory/stats RPCs, invitation_designs readable by senders/coordinators.

-- ---------------------------------------------------------------------------
-- Contact privacy helper (D7)
-- Wedding-wide guests.contacts.view, or coordinator view on that exact group.
-- ---------------------------------------------------------------------------

create or replace function private.can_view_guest_contacts(
  p_wedding_id uuid,
  p_group_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  -- Wedding-wide contacts.view, or coordinator of this exact group (matrix "G").
  -- Do not use can_access_guest_group('view') — that is also true for guests.view alone.
  select private.has_wedding_permission(p_wedding_id, 'guests.contacts.view')
    or (
      p_group_id is not null
      and exists (
        select 1 from public.guest_group_coordinators c
        where c.group_id = p_group_id
          and c.wedding_id = p_wedding_id
          and c.user_id = (select auth.uid())
      )
    );
$$;

revoke all on function private.can_view_guest_contacts(uuid, uuid) from public, anon;
grant execute on function private.can_view_guest_contacts(uuid, uuid)
  to authenticated, service_role;

-- Table-level SELECT implies every column, so strip table grants and re-grant
-- non-contact columns only. Writes still include contact columns; reads use RPCs.
revoke all on table public.guests from public, anon, authenticated;
grant select (
  id, wedding_id, group_id, full_name, side, guest_type, plus_one_allowed,
  created_at, created_by, updated_by, updated_at
) on table public.guests to authenticated;
grant insert (
  id, wedding_id, group_id, full_name, phone, email, side, guest_type,
  plus_one_allowed, dietary_notes, notes, created_at, created_by, updated_by, updated_at
) on table public.guests to authenticated;
grant update (
  group_id, full_name, phone, email, side, guest_type, plus_one_allowed,
  dietary_notes, notes, created_by, updated_by, updated_at
) on table public.guests to authenticated;
grant delete on table public.guests to authenticated;

-- ---------------------------------------------------------------------------
-- Serialize a guest row with contacts nulled when the caller lacks access
-- ---------------------------------------------------------------------------

create or replace function private.guest_to_jsonb(
  p_guest public.guests,
  p_include_contacts boolean,
  p_group_name text default null,
  p_created_by_name text default null,
  p_updated_by_name text default null
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_guest.id,
    'wedding_id', p_guest.wedding_id,
    'group_id', p_guest.group_id,
    'full_name', p_guest.full_name,
    'phone', case when p_include_contacts then p_guest.phone else null end,
    'email', case when p_include_contacts then p_guest.email else null end,
    'side', p_guest.side,
    'guest_type', p_guest.guest_type,
    'plus_one_allowed', p_guest.plus_one_allowed,
    'dietary_notes', case when p_include_contacts then p_guest.dietary_notes else null end,
    'notes', case when p_include_contacts then p_guest.notes else null end,
    'created_at', p_guest.created_at,
    'created_by', p_guest.created_by,
    'updated_by', p_guest.updated_by,
    'updated_at', p_guest.updated_at,
    'created_by_name', p_created_by_name,
    'updated_by_name', p_updated_by_name,
    'contacts_visible', p_include_contacts,
    'group', case
      when p_guest.group_id is null then null
      else jsonb_build_object('id', p_guest.group_id, 'name', coalesce(p_group_name, ''))
    end
  );
$$;

revoke all on function private.guest_to_jsonb(public.guests, boolean, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_wedding_guest / list_wedding_guests
-- ---------------------------------------------------------------------------

create or replace function public.get_wedding_guest(
  p_wedding_id uuid,
  p_guest_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_guest public.guests;
  v_group_name text;
  v_created_name text;
  v_updated_name text;
  v_contacts boolean;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select g.* into v_guest
  from public.guests g
  where g.id = p_guest_id and g.wedding_id = p_wedding_id;

  if not found then
    raise exception 'guest not found' using errcode = 'P0002';
  end if;

  if not (
    private.has_wedding_permission(p_wedding_id, 'guests.view')
    or private.can_access_guest_group(p_wedding_id, v_guest.group_id, 'view')
  ) then
    raise exception 'guest not found' using errcode = 'P0002';
  end if;

  v_contacts := private.can_view_guest_contacts(p_wedding_id, v_guest.group_id);

  select gg.name into v_group_name
  from public.guest_groups gg
  where gg.id = v_guest.group_id;

  select p.display_name into v_created_name
  from public.profiles p where p.id = v_guest.created_by;
  select p.display_name into v_updated_name
  from public.profiles p where p.id = v_guest.updated_by;

  return private.guest_to_jsonb(
    v_guest, v_contacts, v_group_name, v_created_name, v_updated_name
  );
end;
$$;

create or replace function public.list_wedding_guests(
  p_wedding_id uuid,
  p_query text default null,
  p_group_id uuid default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 40), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_pattern text;
  v_row record;
  v_guest public.guests;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_has_more boolean := false;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not (
    private.has_wedding_permission(p_wedding_id, 'guests.view')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = p_wedding_id and c.user_id = v_uid
    )
  ) then
    raise exception 'not a member of this wedding' using errcode = '42501';
  end if;

  if v_q is not null then
    v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  for v_row in
    select g.*, gg.name as group_name
    from public.guests g
    left join public.guest_groups gg on gg.id = g.group_id
    where g.wedding_id = p_wedding_id
      and (
        private.has_wedding_permission(p_wedding_id, 'guests.view')
        or private.can_access_guest_group(p_wedding_id, g.group_id, 'view')
      )
      and (p_group_id is null or g.group_id = p_group_id)
      and (
        v_pattern is null
        or g.full_name ilike v_pattern escape '\'
        or (
          private.can_view_guest_contacts(p_wedding_id, g.group_id)
          and (
            coalesce(g.email, '') ilike v_pattern escape '\'
            or coalesce(g.phone, '') ilike v_pattern escape '\'
          )
        )
      )
    order by g.full_name asc, g.id asc
    offset v_offset
    limit v_limit + 1
  loop
    v_count := v_count + 1;
    if v_count > v_limit then
      v_has_more := true;
      exit;
    end if;

    select * into v_guest from public.guests where id = v_row.id;

    v_items := v_items || jsonb_build_array(
      private.guest_to_jsonb(
        v_guest,
        private.can_view_guest_contacts(p_wedding_id, v_guest.group_id),
        v_row.group_name,
        null,
        null
      )
    );
  end loop;

  return jsonb_build_object('items', v_items, 'has_more', v_has_more);
end;
$$;

revoke all on function public.get_wedding_guest(uuid, uuid) from public, anon;
revoke all on function public.list_wedding_guests(uuid, text, uuid, integer, integer) from public, anon;
grant execute on function public.get_wedding_guest(uuid, uuid) to authenticated, service_role;
grant execute on function public.list_wedding_guests(uuid, text, uuid, integer, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Duplicate check that can read email after column revoke
-- ---------------------------------------------------------------------------

create or replace function public.guest_name_email_taken(
  p_wedding_id uuid,
  p_full_name text,
  p_email text,
  p_exclude_guest_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name text := nullif(btrim(coalesce(p_full_name, '')), '');
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if v_email is null or v_name is null then
    return false;
  end if;
  if not (
    private.has_wedding_permission(p_wedding_id, 'guests.create')
    or private.has_wedding_permission(p_wedding_id, 'guests.update')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = p_wedding_id and c.user_id = v_uid
    )
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.guests g
    where g.wedding_id = p_wedding_id
      and lower(g.full_name) = lower(v_name)
      and lower(coalesce(g.email, '')) = v_email
      and (p_exclude_guest_id is null or g.id <> p_exclude_guest_id)
  );
end;
$$;

revoke all on function public.guest_name_email_taken(uuid, text, text, uuid) from public, anon;
grant execute on function public.guest_name_email_taken(uuid, text, text, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Shared totals (visible guests only — coordinators cannot infer other groups)
-- ---------------------------------------------------------------------------

create or replace function public.get_guest_stats(
  p_wedding_id uuid,
  p_event_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_total integer := 0;
  v_yes integer := 0;
  v_no integer := 0;
  v_maybe integer := 0;
  v_pending integer := 0;
  v_plus integer := 0;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not (
    private.has_wedding_permission(p_wedding_id, 'guests.view')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = p_wedding_id and c.user_id = v_uid
    )
  ) then
    raise exception 'not a member of this wedding' using errcode = '42501';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.wedding_events e
    where e.id = p_event_id and e.wedding_id = p_wedding_id
  ) then
    raise exception 'event not found';
  end if;

  with visible as (
    select g.id, g.plus_one_allowed
    from public.guests g
    where g.wedding_id = p_wedding_id
      and (
        private.has_wedding_permission(p_wedding_id, 'guests.view')
        or private.can_access_guest_group(p_wedding_id, g.group_id, 'view')
      )
  ),
  responses as (
    select
      v.id,
      v.plus_one_allowed,
      case
        when p_event_id is null then (
          select r.response
          from public.guest_rsvps r
          where r.guest_id = v.id
          order by
            case r.response
              when 'yes' then 1
              when 'maybe' then 2
              when 'no' then 3
              else 4
            end,
            r.responded_at desc nulls last
          limit 1
        )
        else (
          select r.response
          from public.guest_rsvps r
          where r.guest_id = v.id and r.event_id = p_event_id
          limit 1
        )
      end as response
    from visible v
  )
  select
    count(*)::integer,
    count(*) filter (where response = 'yes')::integer,
    count(*) filter (where response = 'no')::integer,
    count(*) filter (where response = 'maybe')::integer,
    count(*) filter (where response is null or response = 'pending')::integer,
    count(*) filter (where plus_one_allowed)::integer
  into v_total, v_yes, v_no, v_maybe, v_pending, v_plus
  from responses;

  return jsonb_build_object(
    'total', v_total,
    'yes', v_yes,
    'no', v_no,
    'maybe', v_maybe,
    'pending', v_pending,
    'plus_ones_allowed', v_plus
  );
end;
$$;

revoke all on function public.get_guest_stats(uuid, uuid) from public, anon;
grant execute on function public.get_guest_stats(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- delete_guest / delete_guest_group (atomic invitation cleanup)
-- ---------------------------------------------------------------------------

create or replace function public.delete_guest(
  p_wedding_id uuid,
  p_guest_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select g.group_id into v_group_id
  from public.guests g
  where g.id = p_guest_id and g.wedding_id = p_wedding_id
  for update;

  if not found then
    raise exception 'guest not found';
  end if;

  if not (
    private.has_wedding_permission(p_wedding_id, 'guests.delete')
    or private.can_access_guest_group(p_wedding_id, v_group_id, 'delete')
  ) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from public.invitations i
  where i.wedding_id = p_wedding_id
    and i.guest_id = p_guest_id
    and i.group_id is null;

  delete from public.guests g
  where g.id = p_guest_id and g.wedding_id = p_wedding_id;
end;
$$;

create or replace function public.delete_guest_group(
  p_wedding_id uuid,
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if not private.has_wedding_permission(p_wedding_id, 'guests.manage_all') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.guest_groups gg
    where gg.id = p_group_id and gg.wedding_id = p_wedding_id
  ) then
    raise exception 'group not found';
  end if;

  delete from public.invitations i
  where i.wedding_id = p_wedding_id
    and i.group_id = p_group_id
    and i.guest_id is null;

  delete from public.guest_groups gg
  where gg.id = p_group_id and gg.wedding_id = p_wedding_id;
end;
$$;

revoke all on function public.delete_guest(uuid, uuid) from public, anon;
revoke all on function public.delete_guest_group(uuid, uuid) from public, anon;
grant execute on function public.delete_guest(uuid, uuid) to authenticated, service_role;
grant execute on function public.delete_guest_group(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Coordinator assignment (owner-only)
-- ---------------------------------------------------------------------------

create or replace function public.assign_group_coordinator(
  p_wedding_id uuid,
  p_group_id uuid,
  p_user_id uuid,
  p_can_delete boolean default false,
  p_can_send_invitations boolean default true
)
returns public.guest_group_coordinators
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.guest_group_coordinators;
  v_role text;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can assign group coordinators';
  end if;

  select m.role into v_role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id;

  if not found then
    raise exception 'member not found';
  end if;
  if v_role = 'owner' then
    raise exception 'owners already manage every guest group';
  end if;

  if not exists (
    select 1 from public.guest_groups gg
    where gg.id = p_group_id and gg.wedding_id = p_wedding_id
  ) then
    raise exception 'group not found';
  end if;

  insert into public.guest_group_coordinators (
    wedding_id, group_id, user_id, can_delete, can_send_invitations, assigned_by
  ) values (
    p_wedding_id, p_group_id, p_user_id,
    coalesce(p_can_delete, false),
    coalesce(p_can_send_invitations, true),
    v_uid
  )
  on conflict (group_id, user_id) do update
    set can_delete = excluded.can_delete,
        can_send_invitations = excluded.can_send_invitations,
        assigned_by = excluded.assigned_by,
        assigned_at = now()
  returning * into v_row;

  perform private.log_activity(
    p_wedding_id,
    'coordinator.assigned',
    'guest_group',
    p_group_id,
    'team.view',
    jsonb_build_object(
      'user_id', p_user_id,
      'can_delete', v_row.can_delete,
      'can_send_invitations', v_row.can_send_invitations
    )
  );

  return v_row;
end;
$$;

create or replace function public.unassign_group_coordinator(
  p_wedding_id uuid,
  p_group_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can unassign group coordinators';
  end if;

  delete from public.guest_group_coordinators c
  where c.wedding_id = p_wedding_id
    and c.group_id = p_group_id
    and c.user_id = p_user_id;

  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    raise exception 'coordinator assignment not found';
  end if;

  perform private.log_activity(
    p_wedding_id,
    'coordinator.unassigned',
    'guest_group',
    p_group_id,
    'team.view',
    jsonb_build_object('user_id', p_user_id)
  );
end;
$$;

revoke all on function public.assign_group_coordinator(uuid, uuid, uuid, boolean, boolean)
  from public, anon;
revoke all on function public.unassign_group_coordinator(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_group_coordinator(uuid, uuid, uuid, boolean, boolean)
  to authenticated, service_role;
grant execute on function public.unassign_group_coordinator(uuid, uuid, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- D10: optional family groups (Bride's / Groom's family) — not automatic
-- ---------------------------------------------------------------------------

create or replace function public.ensure_family_guest_groups(p_wedding_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_bride uuid;
  v_groom uuid;
  v_created text[] := '{}';
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.has_wedding_permission(p_wedding_id, 'guests.manage_all') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select gg.id into v_bride
  from public.guest_groups gg
  where gg.wedding_id = p_wedding_id and gg.side = 'partner_one'
  order by gg.created_by nulls last, gg.id
  limit 1;

  if v_bride is null then
    insert into public.guest_groups (wedding_id, name, side)
    values (p_wedding_id, 'Bride''s family', 'partner_one')
    returning id into v_bride;
    v_created := array_append(v_created, 'partner_one');
  end if;

  select gg.id into v_groom
  from public.guest_groups gg
  where gg.wedding_id = p_wedding_id and gg.side = 'partner_two'
  order by gg.created_by nulls last, gg.id
  limit 1;

  if v_groom is null then
    insert into public.guest_groups (wedding_id, name, side)
    values (p_wedding_id, 'Groom''s family', 'partner_two')
    returning id into v_groom;
    v_created := array_append(v_created, 'partner_two');
  end if;

  if cardinality(v_created) > 0 then
    perform private.log_activity(
      p_wedding_id,
      'guest_group.family_ensured',
      'wedding',
      p_wedding_id,
      'guests.manage_all',
      jsonb_build_object('created_sides', to_jsonb(v_created))
    );
  end if;

  return jsonb_build_object(
    'partner_one_group_id', v_bride,
    'partner_two_group_id', v_groom,
    'created_sides', to_jsonb(v_created)
  );
end;
$$;

revoke all on function public.ensure_family_guest_groups(uuid) from public, anon;
grant execute on function public.ensure_family_guest_groups(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- invitation_designs: senders and group coordinators who can send
-- ---------------------------------------------------------------------------

drop policy if exists invitation_designs_select on public.invitation_designs;
create policy invitation_designs_select on public.invitation_designs
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.view')
    or private.has_wedding_permission(wedding_id, 'guests.send_invitations')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = invitation_designs.wedding_id
        and c.user_id = (select auth.uid())
        and c.can_send_invitations
    )
  );

drop policy if exists invitation_designs_insert on public.invitation_designs;
drop policy if exists invitation_designs_update on public.invitation_designs;
drop policy if exists invitation_designs_delete on public.invitation_designs;

create policy invitation_designs_insert on public.invitation_designs
  for insert to authenticated
  with check (
    private.has_wedding_permission(wedding_id, 'guests.send_invitations')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = invitation_designs.wedding_id
        and c.user_id = (select auth.uid())
        and c.can_send_invitations
    )
  );
create policy invitation_designs_update on public.invitation_designs
  for update to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.send_invitations')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = invitation_designs.wedding_id
        and c.user_id = (select auth.uid())
        and c.can_send_invitations
    )
  )
  with check (
    private.has_wedding_permission(wedding_id, 'guests.send_invitations')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = invitation_designs.wedding_id
        and c.user_id = (select auth.uid())
        and c.can_send_invitations
    )
  );
create policy invitation_designs_delete on public.invitation_designs
  for delete to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'guests.send_invitations')
    or exists (
      select 1 from public.guest_group_coordinators c
      where c.wedding_id = invitation_designs.wedding_id
        and c.user_id = (select auth.uid())
        and c.can_send_invitations
    )
  );
