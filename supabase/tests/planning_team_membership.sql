-- Planning Team membership RPCs (Milestone 3).
-- Run after the team_* migrations, including team_membership.
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_membership.sql

begin;

create or replace function pg_temp.make_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email,
    extensions.crypt('password', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', split_part(p_email, '@', 1)), now(), now()
  );
  update public.profiles set display_name = split_part(p_email, '@', 1), phone = '+251911000000'
  where id = v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.as_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function pg_temp.as_admin()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
end;
$$;

create or replace function pg_temp.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function pg_temp.expect_error(p_label text, p_sql text, p_like text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then
      raise exception 'FAIL [%]: expected error like "%", got "%"', p_label, p_like, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL [%]: expected error like "%", but the statement succeeded', p_label, p_like;
end;
$$;

create or replace function pg_temp.check(p_label text, p_ok boolean)
returns void
language plpgsql
as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAIL [%]', p_label;
  end if;
end;
$$;

do $$
declare
  u_owner_a uuid := pg_temp.make_user('m3-owner-a@kiburan.test');
  u_owner_b uuid := pg_temp.make_user('m3-owner-b@kiburan.test');
  u_collab uuid := pg_temp.make_user('m3-collab@kiburan.test');
  u_viewer uuid := pg_temp.make_user('m3-viewer@kiburan.test');
  u_outsider uuid := pg_temp.make_user('m3-outsider@kiburan.test');
  u_other uuid := pg_temp.make_user('m3-other-owner@kiburan.test');
  w uuid;
  w2 uuid;
  v_event uuid;
  v_task uuid;
  v_members jsonb;
  v_count integer;
begin
  perform pg_temp.as_user(u_owner_a);
  select id into w from public.create_wedding('M3 Wedding', 'Selam', 'Dawit');
  perform pg_temp.as_user(u_other);
  select id into w2 from public.create_wedding('M3 Other', 'Hana', 'Yonas');

  perform pg_temp.as_admin();
  perform set_config('kiburan.allow_owner_change', 'on', true);
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w, u_owner_b, 'owner'), (w, u_collab, 'collaborator'), (w, u_viewer, 'viewer');
  perform set_config('kiburan.allow_owner_change', '', true);
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_collab, t.permission from public.wedding_role_templates t where t.template = 'collaborator';
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_viewer, t.permission from public.wedding_role_templates t where t.template = 'viewer';

  insert into public.wedding_events (wedding_id, name) values (w, 'Ceremony') returning id into v_event;
  insert into public.wedding_tasks (wedding_id, title) values (w, 'Book venue') returning id into v_task;
  insert into public.task_assignees (task_id, user_id) values (v_task, u_collab), (v_task, u_viewer);
  insert into public.timeline_items (event_id, title, starts_at, assigned_to)
  values (v_event, 'Processional', now(), u_collab);

  ---------------------------------------------------------------------------
  -- list_team_members
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_collab);
  v_members := public.list_team_members(w);
  perform pg_temp.check('member list size', jsonb_array_length(v_members) = 4);
  perform pg_temp.check('owners listed first',
    v_members -> 0 ->> 'is_owner' = 'true' and v_members -> 1 ->> 'is_owner' = 'true');
  perform pg_temp.check('collaborator cannot see phones',
    (select bool_and(m ->> 'phone' is null) from jsonb_array_elements(v_members) m));
  perform pg_temp.check('self flagged',
    (select bool_or((m ->> 'is_self')::boolean and m ->> 'user_id' = u_collab::text)
     from jsonb_array_elements(v_members) m));

  perform pg_temp.as_user(u_owner_a);
  v_members := public.list_team_members(w);
  perform pg_temp.check('owner can see phones',
    (select bool_and(m ->> 'phone' is not null) from jsonb_array_elements(v_members) m));

  perform pg_temp.as_user(u_outsider);
  perform pg_temp.expect_error('outsider cannot list members',
    format('select public.list_team_members(%L)', w), '%not a member%');

  perform pg_temp.as_user(u_other);
  perform pg_temp.expect_error('other wedding owner cannot list here',
    format('select public.list_team_members(%L)', w), '%not a member%');

  ---------------------------------------------------------------------------
  -- Workspace isolation: each wedding only returns its own members
  ---------------------------------------------------------------------------

  perform pg_temp.as_admin();
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w2, u_collab, 'collaborator');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w2, u_collab, t.permission from public.wedding_role_templates t where t.template = 'collaborator';

  perform pg_temp.as_user(u_collab);
  v_members := public.list_team_members(w);
  perform pg_temp.check('first workspace list excludes other wedding',
    not exists (
      select 1 from jsonb_array_elements(v_members) m
      where m ->> 'user_id' = u_other::text
    )
    and jsonb_array_length(v_members) = 4);
  v_members := public.list_team_members(w2);
  perform pg_temp.check('second workspace list is separate',
    jsonb_array_length(v_members) = 2
    and exists (
      select 1 from jsonb_array_elements(v_members) m
      where m ->> 'user_id' = u_other::text
    ));

  ---------------------------------------------------------------------------
  -- remove_member
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_collab);
  perform pg_temp.expect_error('collaborator cannot remove',
    format('select public.remove_member(%L, %L)', w, u_viewer), '%only wedding owners%');

  perform pg_temp.as_user(u_owner_a);
  perform pg_temp.expect_error('cannot remove an owner',
    format('select public.remove_member(%L, %L)', w, u_owner_b), '%ownership workflow%');
  perform pg_temp.expect_error('cannot remove yourself via remove_member',
    format('select public.remove_member(%L, %L)', w, u_owner_a), '%leave_wedding%');
  perform pg_temp.expect_error('cannot remove outsider',
    format('select public.remove_member(%L, %L)', w, u_outsider), '%member not found%');

  perform public.remove_member(w, u_viewer);

  select count(*) into v_count from public.wedding_members where wedding_id = w and user_id = u_viewer;
  perform pg_temp.check('viewer membership deleted', v_count = 0);
  select count(*) into v_count from public.task_assignees where task_id = v_task and user_id = u_viewer;
  perform pg_temp.check('viewer task assignments cleared', v_count = 0);
  select count(*) into v_count from public.task_assignees where task_id = v_task and user_id = u_collab;
  perform pg_temp.check('other assignees untouched', v_count = 1);
  select count(*) into v_count from public.wedding_activity_log
  where wedding_id = w and action = 'member.removed' and entity_id = u_viewer;
  perform pg_temp.check('removal logged', v_count = 1);

  -- Immediate access loss for the removed member.
  perform pg_temp.as_user(u_viewer);
  perform pg_temp.expect_error('removed member cannot list',
    format('select public.list_team_members(%L)', w), '%not a member%');
  perform pg_temp.expect_error('removed member cannot read access',
    format('select public.get_my_wedding_access(%L)', w), '%not a member%');
  select count(*) into v_count from public.weddings where id = w;
  perform pg_temp.check('removed member cannot see the wedding', v_count = 0);

  ---------------------------------------------------------------------------
  -- leave_wedding
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner_a);
  -- Re-add a viewer so the wedding still has a non-owner after the collaborator leaves.
  perform pg_temp.as_admin();
  insert into public.wedding_members (wedding_id, user_id, role) values (w, u_viewer, 'viewer');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_viewer, t.permission from public.wedding_role_templates t where t.template = 'viewer';

  perform pg_temp.as_user(u_collab);
  perform public.leave_wedding(w);
  select count(*) into v_count from public.wedding_members where wedding_id = w and user_id = u_collab;
  perform pg_temp.check('collaborator left', v_count = 0);
  select count(*) into v_count from public.task_assignees where task_id = v_task and user_id = u_collab;
  perform pg_temp.check('leaver task assignments cleared', v_count = 0);
  select count(*) into v_count from public.timeline_items
  where event_id = v_event and assigned_to = u_collab;
  perform pg_temp.check('leaver timeline assignment cleared', v_count = 0);
  -- Still a member of the other wedding.
  select count(*) into v_count from public.wedding_members where wedding_id = w2 and user_id = u_collab;
  perform pg_temp.check('leave is wedding-scoped', v_count = 1);

  perform pg_temp.as_user(u_owner_a);
  select count(*) into v_count from public.wedding_activity_log
  where wedding_id = w and action = 'member.left' and entity_id = u_collab;
  perform pg_temp.check('leave logged', v_count = 1);

  perform pg_temp.as_user(u_owner_a);
  perform public.leave_wedding(w);

  perform pg_temp.as_user(u_owner_b);
  select count(*) into v_count from public.wedding_members
  where wedding_id = w and user_id = u_owner_a;
  perform pg_temp.check('owner left when co-owner remains', v_count = 0);
  select count(*) into v_count from public.wedding_members
  where wedding_id = w and role = 'owner';
  perform pg_temp.check('remaining owner stays', v_count = 1);
  perform pg_temp.expect_error('sole owner cannot leave',
    format('select public.leave_wedding(%L)', w), '%only owner cannot leave%');

  perform pg_temp.as_user(u_outsider);
  perform pg_temp.expect_error('non-member cannot leave',
    format('select public.leave_wedding(%L)', w), '%not a member%');

  perform pg_temp.as_anon();
  perform pg_temp.expect_error('anon cannot list members',
    format('select public.list_team_members(%L)', w), 'permission denied%');
  perform pg_temp.expect_error('anon cannot remove members',
    format('select public.remove_member(%L, %L)', w, u_viewer), 'permission denied%');
  perform pg_temp.expect_error('anon cannot leave',
    format('select public.leave_wedding(%L)', w), 'permission denied%');

  raise notice 'PASS: planning_team_membership checks completed';
end;
$$;

rollback;
