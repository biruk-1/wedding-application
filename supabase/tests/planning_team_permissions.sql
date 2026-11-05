-- Planning Team permission RPCs + RLS switch (Milestone 5).
-- Run after team_permission_* migrations.
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_permissions.sql

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
  u_owner uuid := pg_temp.make_user('m5-owner@kiburan.test');
  u_task uuid := pg_temp.make_user('m5-task@kiburan.test');
  u_viewer uuid := pg_temp.make_user('m5-viewer@kiburan.test');
  u_outsider uuid := pg_temp.make_user('m5-outsider@kiburan.test');
  w uuid;
  v_task uuid;
  v_item uuid;
  v_count integer;
  v_perms jsonb;
  v_summary jsonb;
  v_wedding public.weddings;
  v_member public.wedding_members;
begin
  perform pg_temp.as_user(u_owner);
  select id into w from public.create_wedding(
    'M5 Wedding', 'Selam', 'Dawit', null, null, 'ET', 'Africa/Addis_Ababa', null, 'ETB', null, 'wedding', 10000,
    '[{"category_slug":"venue","amount":4000}]'::jsonb
  );

  perform pg_temp.as_admin();
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w, u_task, 'task_manager'), (w, u_viewer, 'viewer');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_task, t.permission from public.wedding_role_templates t where t.template = 'task_manager';
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_viewer, t.permission from public.wedding_role_templates t where t.template = 'viewer';

  select id into v_item from public.budget_items where wedding_id = w and item_kind = 'allocation' limit 1;
  perform pg_temp.check('create_wedding allocations are item_kind=allocation', v_item is not null);

  ---------------------------------------------------------------------------
  -- set_member_role_template / set_member_permissions
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select * into v_member from public.set_member_role_template(w, u_task, 'task_manager', true);
  perform pg_temp.check('role template applied', v_member.role = 'task_manager');
  select count(*) into v_count from public.wedding_member_permissions
  where wedding_id = w and user_id = u_task and permission = 'tasks.update';
  perform pg_temp.check('template grants tasks.update', v_count = 1);

  perform pg_temp.expect_error('cannot template an outsider',
    format('select public.set_member_role_template(%L, %L, %L)', w, u_outsider, 'viewer'),
    '%member not found%');
  perform pg_temp.expect_error('cannot demote self via template',
    format('select public.set_member_role_template(%L, %L, %L)', w, u_owner, 'viewer'),
    '%cannot change their own role%');
  perform pg_temp.expect_error('reserved owner permission rejected',
    format('select public.set_member_permissions(%L, %L, array[%L]::text[])', w, u_task, 'team.invite'),
    '%not grantable%');

  v_perms := public.set_member_permissions(w, u_task, array['tasks.view', 'tasks.update', 'tasks.create']);
  perform pg_temp.check('set_member_permissions returns keys',
    v_perms ? 'tasks.view' and v_perms ? 'tasks.update' and v_perms ? 'tasks.create');

  perform pg_temp.as_user(u_task);
  perform pg_temp.expect_error('non-owner cannot set permissions',
    format('select public.set_member_permissions(%L, %L, array[%L]::text[])', w, u_viewer, 'tasks.view'),
    '%only wedding owners%');

  ---------------------------------------------------------------------------
  -- Feature RLS: tasks vs budget
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_task);
  insert into public.wedding_tasks (wedding_id, title) values (w, 'Book florist') returning id into v_task;
  perform pg_temp.check('task_manager can create tasks', v_task is not null);
  update public.wedding_tasks set title = 'Book florist + decor' where id = v_task;
  select count(*) into v_count from public.wedding_tasks where id = v_task and title = 'Book florist + decor';
  perform pg_temp.check('task_manager can update tasks', v_count = 1);

  select count(*) into v_count from public.budget_items where wedding_id = w;
  perform pg_temp.check('task_manager cannot read budget lines', v_count = 0);

  perform pg_temp.as_user(u_viewer);
  select count(*) into v_count from public.wedding_tasks where wedding_id = w;
  perform pg_temp.check('viewer can read tasks', v_count >= 1);
  update public.wedding_tasks set title = 'Viewer rewrite' where id = v_task;
  select count(*) into v_count from public.wedding_tasks where id = v_task and title = 'Book florist + decor';
  perform pg_temp.check('viewer cannot update tasks', v_count = 1);

  ---------------------------------------------------------------------------
  -- Revocation takes effect on the next statement
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  perform public.set_member_permissions(w, u_task, array['tasks.view']);

  perform pg_temp.as_user(u_task);
  update public.wedding_tasks set title = 'Should fail' where id = v_task;
  select count(*) into v_count from public.wedding_tasks where id = v_task and title = 'Book florist + decor';
  perform pg_temp.check('revoked tasks.update blocks writes immediately', v_count = 1);

  ---------------------------------------------------------------------------
  -- get_budget_summary + update_wedding_settings
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  v_summary := public.get_budget_summary(w);
  perform pg_temp.check('owner gets budget summary',
    (v_summary ->> 'total_budget')::numeric = 10000);

  perform pg_temp.as_admin();
  insert into public.budget_items (wedding_id, label, estimated_amount, item_kind)
  values (w, 'Deposit', 500, 'expense');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values (w, u_viewer, 'budget.view')
  on conflict do nothing;

  perform pg_temp.as_user(u_viewer);
  v_summary := public.get_budget_summary(w);
  perform pg_temp.check('viewer with budget.view gets summary',
    (v_summary ->> 'total_budget')::numeric = 10000);
  select count(*) into v_count from public.budget_items
  where wedding_id = w and item_kind = 'allocation';
  perform pg_temp.check('budget.view can read allocations', v_count >= 1);
  select count(*) into v_count from public.budget_items
  where wedding_id = w and item_kind = 'expense';
  perform pg_temp.check('budget.view alone hides expenses', v_count = 0);

  perform pg_temp.as_user(u_task);
  perform pg_temp.expect_error('no budget.view means no summary',
    format('select public.get_budget_summary(%L)', w),
    '%budget access denied%');

  perform pg_temp.as_user(u_owner);
  select * into v_wedding from public.update_wedding_settings(w, 'M5 Wedding Updated');
  perform pg_temp.check('owner updates settings via RPC', v_wedding.title = 'M5 Wedding Updated');

  perform pg_temp.as_user(u_task);
  perform pg_temp.expect_error('non-owner cannot update settings',
    format('select public.update_wedding_settings(%L, %L)', w, 'Hijacked'),
    '%only wedding owners%');

  update public.weddings set title = 'Direct hijack' where id = w;
  perform pg_temp.as_admin();
  select count(*) into v_count from public.weddings where id = w and title = 'M5 Wedding Updated';
  perform pg_temp.check('direct wedding updates are blocked by RLS', v_count = 1);

  raise notice 'PASS: planning_team_permissions checks completed';
end;
$$;

rollback;
