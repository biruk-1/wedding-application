-- Planning Team, Milestone 3: membership listing, remove, and leave.
-- Depends on 20261106*_team_* foundation (permissions helpers, owner guards, activity log).
-- Feature-table RLS still uses can_write_wedding until Milestone 5.

-- ---------------------------------------------------------------------------
-- Shared cleanup when a person leaves or is removed from a wedding.
-- Clears their task assignments and timeline assignments for that wedding only.
-- ---------------------------------------------------------------------------

create or replace function private.clear_member_work_assignments(
  p_wedding_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_assignees a
  using public.wedding_tasks t
  where a.task_id = t.id
    and t.wedding_id = p_wedding_id
    and a.user_id = p_user_id;

  update public.timeline_items i
  set assigned_to = null
  from public.wedding_events e
  where i.event_id = e.id
    and e.wedding_id = p_wedding_id
    and i.assigned_to = p_user_id;
end;
$$;

revoke all on function private.clear_member_work_assignments(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- list_team_members: any current member of the wedding.
-- team.view gating arrives with the Milestone 5 permission backfill; until then this
-- matches the existing wedding_members SELECT policy (any member can see the roster).
-- Phone numbers are returned only to owners.
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
  if not private.is_wedding_member(p_wedding_id) then
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

revoke all on function public.list_team_members(uuid) from public, anon;
grant execute on function public.list_team_members(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- remove_member: owner removes a non-owner collaborator.
-- ---------------------------------------------------------------------------

create or replace function public.remove_member(
  p_wedding_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_role text;
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can remove members';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;
  if p_user_id = v_uid then
    raise exception 'use leave_wedding to leave this wedding yourself';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  select m.role, coalesce(nullif(btrim(p.display_name), ''), 'Member')
  into v_target_role, v_display_name
  from public.wedding_members m
  join public.profiles p on p.id = m.user_id
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  for update of m;

  if not found then
    raise exception 'member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'ownership can only change through the ownership workflow';
  end if;

  perform private.clear_member_work_assignments(p_wedding_id, p_user_id);

  delete from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id;

  perform private.log_activity(
    p_wedding_id,
    'member.removed',
    'member',
    p_user_id,
    'team.view',
    jsonb_build_object(
      'user_id', p_user_id,
      'display_name', v_display_name,
      'role', v_target_role
    )
  );
end;
$$;

revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- leave_wedding: a member leaves. An owner may leave only when another owner remains.
-- ---------------------------------------------------------------------------

create or replace function public.leave_wedding(p_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_owner_count integer;
  v_display_name text;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;
  if not found then
    raise exception 'wedding not found';
  end if;

  select m.role into v_role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = v_uid
  for update;

  if not found then
    raise exception 'not a member of this wedding' using errcode = '42501';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.wedding_members m
    where m.wedding_id = p_wedding_id and m.role = 'owner';
    if v_owner_count < 2 then
      raise exception 'the only owner cannot leave this wedding';
    end if;
    -- Owner-count and ownership-guard triggers allow this intentional leave.
    perform set_config('kiburan.allow_owner_change', 'on', true);
  end if;

  select coalesce(nullif(btrim(p.display_name), ''), 'Member')
  into v_display_name
  from public.profiles p
  where p.id = v_uid;

  perform private.clear_member_work_assignments(p_wedding_id, v_uid);

  delete from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = v_uid;

  -- Log after delete so the actor is still auth.uid(); wedding still exists.
  perform private.log_activity(
    p_wedding_id,
    'member.left',
    'member',
    v_uid,
    'team.view',
    jsonb_build_object(
      'user_id', v_uid,
      'display_name', coalesce(v_display_name, 'Member'),
      'role', v_role
    )
  );
end;
$$;

revoke all on function public.leave_wedding(uuid) from public, anon;
grant execute on function public.leave_wedding(uuid) to authenticated, service_role;
