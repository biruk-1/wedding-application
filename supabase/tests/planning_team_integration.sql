-- Planning Team multi-role integration (Milestone 9).
-- Full cast of roles on one wedding + a second wedding for workspace isolation.
-- Rolls back; nothing persists.
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_integration.sql

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
  update public.profiles set display_name = split_part(p_email, '@', 1)
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

create or replace function pg_temp.grant_template(p_wedding uuid, p_user uuid, p_template text)
returns void
language plpgsql
as $$
begin
  insert into public.wedding_members (wedding_id, user_id, role)
  values (p_wedding, p_user, p_template)
  on conflict do nothing;
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select p_wedding, p_user, t.permission
  from public.wedding_role_templates t
  where t.template = p_template
  on conflict do nothing;
end;
$$;

do $$
declare
  u_owner_a uuid := pg_temp.make_user('m9-owner-a@kiburan.test');
  u_owner_b uuid := pg_temp.make_user('m9-owner-b@kiburan.test');
  u_cohost uuid := pg_temp.make_user('m9-cohost@kiburan.test');
  u_planner uuid := pg_temp.make_user('m9-planner@kiburan.test');
  u_bride_coord uuid := pg_temp.make_user('m9-bride-coord@kiburan.test');
  u_groom_coord uuid := pg_temp.make_user('m9-groom-coord@kiburan.test');
  u_task uuid := pg_temp.make_user('m9-task@kiburan.test');
  u_viewer uuid := pg_temp.make_user('m9-viewer@kiburan.test');
  u_custom uuid := pg_temp.make_user('m9-custom@kiburan.test');
  u_outsider uuid := pg_temp.make_user('m9-outsider@kiburan.test');
  u_other_owner uuid := pg_temp.make_user('m9-other-owner@kiburan.test');
  u_invitee uuid := pg_temp.make_user('m9-invitee@kiburan.test');
  w uuid;
  w2 uuid;
  v_bride uuid;
  v_groom uuid;
  v_family jsonb;
  v_guest_bride uuid;
  v_guest_groom uuid;
  v_guest_shared uuid;
  v_task uuid;
  v_file uuid;
  v_invite_id uuid;
  v_token text;
  v_access jsonb;
  v_summary jsonb;
  v_members jsonb;
  v_count integer;
  v_title text;
  v_name text;
begin
  ---------------------------------------------------------------------------
  -- Fixture: wedding A with full cast; wedding B owned by outsider owner
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner_a);
  select id into w from public.create_wedding(
    'M9 Wedding', 'Selam', 'Dawit', null, null, 'ET', 'Africa/Addis_Ababa', null, 'ETB', null, 'wedding', 20000,
    '[{"category_slug":"venue","amount":8000}]'::jsonb
  );

  perform pg_temp.as_user(u_other_owner);
  select id into w2 from public.create_wedding('M9 Other Wedding', 'Hana', 'Yonas');

  perform pg_temp.as_user(u_owner_a);
  v_family := public.ensure_family_guest_groups(w);
  v_bride := (v_family ->> 'partner_one_group_id')::uuid;
  v_groom := (v_family ->> 'partner_two_group_id')::uuid;
  perform pg_temp.check('family groups ready', v_bride is not null and v_groom is not null);

  perform pg_temp.as_admin();
  perform set_config('kiburan.allow_owner_change', 'on', true);
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w, u_owner_b, 'owner');
  perform set_config('kiburan.allow_owner_change', '', true);

  perform pg_temp.grant_template(w, u_cohost, 'co_host');
  perform pg_temp.grant_template(w, u_planner, 'planner');
  perform pg_temp.grant_template(w, u_bride_coord, 'family_coordinator');
  perform pg_temp.grant_template(w, u_groom_coord, 'family_coordinator');
  perform pg_temp.grant_template(w, u_task, 'task_manager');
  perform pg_temp.grant_template(w, u_viewer, 'viewer');
  perform pg_temp.grant_template(w, u_custom, 'custom');

  -- Collaborator also on wedding B to prove workspace switching.
  perform pg_temp.grant_template(w2, u_planner, 'planner');

  perform pg_temp.as_user(u_owner_a);
  perform public.assign_group_coordinator(w, v_bride, u_bride_coord, false, true);
  perform public.assign_group_coordinator(w, v_groom, u_groom_coord, false, true);

  insert into public.guests (wedding_id, group_id, full_name, phone, email)
  values (w, v_bride, 'Bride Aunt', '+251911100001', 'bride.aunt@kiburan.test')
  returning id into v_guest_bride;
  insert into public.guests (wedding_id, group_id, full_name, phone, email)
  values (w, v_groom, 'Groom Uncle', '+251911100002', 'groom.uncle@kiburan.test')
  returning id into v_guest_groom;
  insert into public.guests (wedding_id, group_id, full_name)
  values (w, v_bride, 'Shared edit target')
  returning id into v_guest_shared;

  insert into public.wedding_tasks (wedding_id, title)
  values (w, 'Book band') returning id into v_task;

  insert into public.wedding_files (wedding_id, display_name, storage_path, uploaded_by)
  values (w, 'Contract.pdf', w::text || '/docs/contract.pdf', u_owner_a)
  returning id into v_file;

  ---------------------------------------------------------------------------
  -- Equal owners
  ---------------------------------------------------------------------------

  select count(*) into v_count from public.wedding_members
  where wedding_id = w and role = 'owner';
  perform pg_temp.check('two equal owners', v_count = 2);

  perform pg_temp.as_user(u_owner_b);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('owner B is_owner', (v_access ->> 'is_owner')::boolean);
  v_members := public.list_team_members(w);
  perform pg_temp.check('owner B lists full team', jsonb_array_length(v_members) >= 9);

  -- Owner B can invite; cannot demote/remove owner A or change their template.
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm9-invitee@kiburan.test', 'collaborator', 'viewer');
  perform pg_temp.check('owner B can invite', v_token is not null);

  perform pg_temp.expect_error('owner cannot remove other owner',
    format('select public.remove_member(%L, %L)', w, u_owner_a),
    '%ownership%');
  perform pg_temp.expect_error('owner cannot demote other owner via template',
    format('select public.set_member_role_template(%L, %L, %L)', w, u_owner_a, 'viewer'),
    '%ownership%');

  ---------------------------------------------------------------------------
  -- Non-owners cannot invite / manage permissions
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_cohost);
  perform pg_temp.expect_error('co-host cannot invite',
    format('select * from public.create_team_invite(%L, %L)', w, 'x@kiburan.test'),
    '%only wedding owners%');
  perform pg_temp.expect_error('co-host cannot set permissions',
    format('select public.set_member_permissions(%L, %L, array[%L]::text[])', w, u_viewer, 'tasks.view'),
    '%only wedding owners%');

  perform pg_temp.as_user(u_planner);
  perform pg_temp.expect_error('planner cannot invite',
    format('select * from public.create_team_invite(%L, %L)', w, 'y@kiburan.test'),
    '%only wedding owners%');

  ---------------------------------------------------------------------------
  -- Access shapes by role
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_task);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('task_manager has tasks.update',
    (v_access -> 'permissions') ? 'tasks.update');
  perform pg_temp.check('task_manager lacks budget.view',
    not ((v_access -> 'permissions') ? 'budget.view'));

  perform pg_temp.as_user(u_viewer);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('viewer has tasks.view',
    (v_access -> 'permissions') ? 'tasks.view');
  perform pg_temp.check('viewer lacks tasks.update',
    not ((v_access -> 'permissions') ? 'tasks.update'));

  perform pg_temp.as_user(u_custom);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('custom starts with team.view only',
    (v_access -> 'permissions') ? 'team.view'
    and jsonb_array_length(v_access -> 'permissions') = 1);

  perform pg_temp.as_user(u_bride_coord);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('bride coord has coordinated group',
    jsonb_array_length(v_access -> 'coordinated_groups') = 1
    and v_access -> 'coordinated_groups' -> 0 ->> 'group_id' = v_bride::text);

  ---------------------------------------------------------------------------
  -- Group isolation (bride vs groom coordinators)
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_bride_coord);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('bride coord sees only bride guests', v_count = 2);
  select count(*) into v_count from public.guests where id = v_guest_groom;
  perform pg_temp.check('bride coord cannot see groom guest', v_count = 0);

  perform pg_temp.as_user(u_groom_coord);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('groom coord sees only groom guests', v_count = 1);
  select count(*) into v_count from public.guests where id = v_guest_bride;
  perform pg_temp.check('groom coord cannot see bride guest', v_count = 0);

  update public.guests set full_name = 'Groom Uncle Updated' where id = v_guest_groom;
  select full_name into v_name from public.guests where id = v_guest_groom;
  perform pg_temp.check('groom coord can update own group guest', v_name = 'Groom Uncle Updated');

  update public.guests set full_name = 'Hijack' where id = v_guest_bride;
  get diagnostics v_count = row_count;
  perform pg_temp.check('groom coord update on bride guest affects 0 rows', v_count = 0);
  perform pg_temp.as_admin();
  select full_name into v_name from public.guests where id = v_guest_bride;
  perform pg_temp.check('bride guest name unchanged after blocked update', v_name = 'Bride Aunt');
  perform pg_temp.as_user(u_groom_coord);

  ---------------------------------------------------------------------------
  -- Budget + documents isolation
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_task);
  select count(*) into v_count from public.budget_items where wedding_id = w;
  perform pg_temp.check('task_manager cannot read budget lines', v_count = 0);
  perform pg_temp.expect_error('task_manager no budget summary',
    format('select public.get_budget_summary(%L)', w),
    '%budget access denied%');
  select count(*) into v_count from public.wedding_files where wedding_id = w;
  perform pg_temp.check('task_manager can read documents.view files', v_count = 1);

  perform pg_temp.as_user(u_viewer);
  select count(*) into v_count from public.wedding_files where wedding_id = w;
  perform pg_temp.check('viewer without documents.view sees no files', v_count = 0);
  perform pg_temp.expect_error('viewer no budget summary',
    format('select public.get_budget_summary(%L)', w),
    '%budget access denied%');

  perform pg_temp.as_user(u_cohost);
  -- co_host template has no budget by design (D15).
  perform pg_temp.expect_error('co-host has no budget by default',
    format('select public.get_budget_summary(%L)', w),
    '%budget access denied%');
  select count(*) into v_count from public.wedding_files where wedding_id = w;
  perform pg_temp.check('co-host can read documents', v_count = 1);

  perform pg_temp.as_user(u_owner_a);
  v_summary := public.get_budget_summary(w);
  perform pg_temp.check('owner budget summary',
    (v_summary ->> 'total_budget')::numeric = 20000);

  ---------------------------------------------------------------------------
  -- Invite accept / revoke / expire / wrong account (spot-check pipeline)
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_outsider);
  perform pg_temp.expect_error('wrong account cannot accept owner-B invite',
    format('select public.accept_team_invite(%L)', v_token),
    '%different email address%');

  perform pg_temp.as_user(u_owner_a);
  perform public.revoke_team_invite(v_invite_id);
  perform pg_temp.as_user(u_invitee);
  perform pg_temp.expect_error('revoked invite rejected',
    format('select public.accept_team_invite(%L)', v_token),
    '%revoked%');

  perform pg_temp.as_user(u_owner_a);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(
    w, 'm9-invitee@kiburan.test', 'collaborator', 'viewer', null, null, interval '1 hour'
  );
  perform pg_temp.as_admin();
  update public.wedding_invites set expires_at = now() - interval '1 minute' where id = v_invite_id;
  perform pg_temp.as_user(u_invitee);
  perform pg_temp.expect_error('expired invite rejected',
    format('select public.accept_team_invite(%L)', v_token),
    '%expired%');

  perform pg_temp.as_user(u_owner_a);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm9-invitee@kiburan.test', 'collaborator', 'custom');
  perform pg_temp.as_user(u_invitee);
  perform public.accept_team_invite(v_token);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('invitee joined as custom',
    v_access ->> 'role' = 'custom'
    and (v_access -> 'permissions') ? 'team.view');

  ---------------------------------------------------------------------------
  -- Cross-wedding isolation + workspace switching
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_planner);
  select count(*) into v_count from public.wedding_tasks where wedding_id = w;
  perform pg_temp.check('planner sees wedding A tasks', v_count >= 1);
  select count(*) into v_count from public.wedding_tasks where wedding_id = w2;
  perform pg_temp.check('planner sees no leaked tasks from empty wedding B', v_count = 0);

  perform pg_temp.as_user(u_other_owner);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('other wedding owner cannot see wedding A guests', v_count = 0);
  perform pg_temp.expect_error('other owner cannot list wedding A team',
    format('select public.list_team_members(%L)', w),
    '%not a member%');
  perform pg_temp.expect_error('outsider cannot get access',
    format('select public.get_my_wedding_access(%L)', w),
    '%not a member%');

  perform pg_temp.as_user(u_outsider);
  select count(*) into v_count from public.weddings where id = w;
  perform pg_temp.check('true outsider cannot see wedding row', v_count = 0);

  ---------------------------------------------------------------------------
  -- Concurrent edits on same guest / task (both permitted writers succeed)
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_planner);
  update public.guests set full_name = 'Planner edit' where id = v_guest_shared;
  select full_name into v_name from public.guests where id = v_guest_shared;
  perform pg_temp.check('planner concurrent guest edit', v_name = 'Planner edit');

  perform pg_temp.as_user(u_owner_b);
  update public.guests set full_name = 'Owner B edit' where id = v_guest_shared;
  select full_name into v_name from public.guests where id = v_guest_shared;
  perform pg_temp.check('owner concurrent guest edit wins last write', v_name = 'Owner B edit');

  perform pg_temp.as_user(u_task);
  update public.wedding_tasks set title = 'Task manager edit' where id = v_task;
  select title into v_title from public.wedding_tasks where id = v_task;
  perform pg_temp.check('task_manager concurrent task edit', v_title = 'Task manager edit');

  perform pg_temp.as_user(u_planner);
  update public.wedding_tasks set title = 'Planner task edit' where id = v_task;
  select title into v_title from public.wedding_tasks where id = v_task;
  perform pg_temp.check('planner concurrent task edit', v_title = 'Planner task edit');

  ---------------------------------------------------------------------------
  -- Planner can manage guests; viewer cannot; custom cannot see guests
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_planner);
  insert into public.guests (wedding_id, group_id, full_name)
  values (w, v_bride, 'Planner guest') returning id into v_guest_shared;

  perform pg_temp.as_user(u_viewer);
  update public.guests set full_name = 'Viewer hijack' where id = v_guest_shared;
  get diagnostics v_count = row_count;
  perform pg_temp.check('viewer update on guests affects 0 rows', v_count = 0);
  perform pg_temp.as_admin();
  select full_name into v_name from public.guests where id = v_guest_shared;
  perform pg_temp.check('guest name unchanged after viewer attempt', v_name = 'Planner guest');

  perform pg_temp.as_user(u_custom);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('custom without guests.view sees none', v_count = 0);

  ---------------------------------------------------------------------------
  -- Co-owner cap still enforced with two owners already present
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner_a);
  perform pg_temp.expect_error('third co-owner invite blocked',
    format('select * from public.create_team_invite(%L, %L, %L)', w, 'm9-third@kiburan.test', 'co_owner'),
    '%already has two owners%');

  raise notice 'PASS: planning_team_integration checks completed';
end;
$$;

rollback;
