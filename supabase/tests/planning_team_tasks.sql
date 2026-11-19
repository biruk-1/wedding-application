-- Planning Team task collaboration (Milestone 7).
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_tasks.sql

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
  u_owner uuid := pg_temp.make_user('m7-owner@kiburan.test');
  u_assignee uuid := pg_temp.make_user('m7-assignee@kiburan.test');
  u_viewer uuid := pg_temp.make_user('m7-viewer@kiburan.test');
  w uuid;
  v_task uuid;
  v_comment uuid;
  v_json jsonb;
  v_count integer;
  v_status text;
  v_title text;
begin
  perform pg_temp.as_user(u_owner);
  select id into w from public.create_wedding('M7 Wedding', 'Selam', 'Dawit');

  perform pg_temp.as_admin();
  -- Assignee has tasks.view only (no tasks.update) so the status-column rule can be proven.
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w, u_assignee, 'custom'), (w, u_viewer, 'viewer');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values
    (w, u_assignee, 'team.view'),
    (w, u_assignee, 'tasks.view'),
    (w, u_viewer, 'team.view'),
    (w, u_viewer, 'tasks.view');

  perform pg_temp.as_user(u_owner);
  insert into public.wedding_tasks (wedding_id, title, status)
  values (w, 'Book florist', 'todo')
  returning id into v_task;

  ---------------------------------------------------------------------------
  -- set_task_assignees atomic RPC
  ---------------------------------------------------------------------------

  v_json := public.set_task_assignees(v_task, array[u_assignee]);
  perform pg_temp.check('assignee applied', jsonb_array_length(v_json) = 1);
  perform pg_temp.check('assigned_by recorded', v_json -> 0 ->> 'assigned_by' = u_owner::text);

  perform pg_temp.expect_error('non-member cannot be assigned',
    format('select public.set_task_assignees(%L, array[%L]::uuid[])', v_task, gen_random_uuid()),
    '%must be members%');

  perform pg_temp.as_user(u_viewer);
  perform pg_temp.expect_error('viewer cannot assign',
    format('select public.set_task_assignees(%L, array[%L]::uuid[])', v_task, u_viewer),
    '%permission denied%');

  ---------------------------------------------------------------------------
  -- Assignee status-only updates
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_assignee);
  update public.wedding_tasks set status = 'done' where id = v_task;
  select status into v_status from public.wedding_tasks where id = v_task;
  perform pg_temp.check('assignee can mark done', v_status = 'done');

  perform pg_temp.expect_error('assignee cannot rename',
    format('update public.wedding_tasks set title = %L where id = %L', 'Hijack', v_task),
    '%assignees may only change task status%');
  select title into v_title from public.wedding_tasks where id = v_task;
  perform pg_temp.check('title unchanged after blocked rename', v_title = 'Book florist');

  ---------------------------------------------------------------------------
  -- Comments: assignee may comment; viewer may not
  ---------------------------------------------------------------------------

  insert into public.task_comments (task_id, author_id, body)
  values (v_task, u_assignee, 'Ordering tomorrow')
  returning id into v_comment;
  perform pg_temp.check('assignee can comment', v_comment is not null);

  perform pg_temp.as_user(u_viewer);
  perform pg_temp.expect_error('viewer without tasks.comment cannot comment',
    format(
      'insert into public.task_comments (task_id, author_id, body) values (%L, %L, %L)',
      v_task, u_viewer, 'Nope'
    ),
    '%');

  ---------------------------------------------------------------------------
  -- Activity entries exist for task collaboration
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select count(*) into v_count
  from public.wedding_activity_log
  where wedding_id = w and entity_type = 'task' and entity_id = v_task;
  perform pg_temp.check('task activity logged', v_count >= 2);

  perform pg_temp.as_user(u_assignee);
  select count(*) into v_count
  from public.wedding_activity_log
  where wedding_id = w and entity_type = 'task' and entity_id = v_task;
  perform pg_temp.check('assignee with tasks.view can read task activity', v_count >= 2);

  -- Clear assignees atomically
  perform pg_temp.as_user(u_owner);
  v_json := public.set_task_assignees(v_task, '{}'::uuid[]);
  perform pg_temp.check('clear assignees', jsonb_array_length(v_json) = 0);

  perform pg_temp.as_user(u_assignee);
  update public.wedding_tasks set status = 'todo' where id = v_task;
  perform pg_temp.as_admin();
  select status into v_status from public.wedding_tasks where id = v_task;
  perform pg_temp.check('former assignee cannot update status', v_status = 'done');

  raise notice 'PASS: planning_team_tasks checks completed';
end;
$$;

rollback;
