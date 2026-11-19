-- Planning Team, Milestone 7: task collaboration.
-- Atomic assignees RPC, assignee status-only updates, task activity logging.

-- ---------------------------------------------------------------------------
-- Optional attribution on assignees
-- ---------------------------------------------------------------------------

alter table public.task_assignees
  add column if not exists assigned_by uuid references public.profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.is_task_assignee(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.task_assignees a
    where a.task_id = p_task_id
      and a.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_task_assignee(uuid) from public, anon;
grant execute on function private.is_task_assignee(uuid) to authenticated, service_role;

-- Assignees without tasks.update may only change status (+ completed_at / updated_at side effects).
create or replace function private.enforce_task_assignee_update_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.has_wedding_permission(new.wedding_id, 'tasks.update') then
    return new;
  end if;

  if not private.is_task_assignee(new.id) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if (new.wedding_id, new.event_id, new.category_id, new.template_id, new.parent_task_id,
      new.title, new.description, new.priority, new.due_date, new.created_by, new.sort_order)
     is distinct from
     (old.wedding_id, old.event_id, old.category_id, old.template_id, old.parent_task_id,
      old.title, old.description, old.priority, old.due_date, old.created_by, old.sort_order)
  then
    raise exception 'assignees may only change task status' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status
     and new.completed_at is not distinct from old.completed_at then
    raise exception 'assignees may only change task status' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_assignee_update_columns()
  from public, anon, authenticated;

drop trigger if exists wedding_tasks_assignee_column_guard on public.wedding_tasks;
create trigger wedding_tasks_assignee_column_guard
  before update on public.wedding_tasks
  for each row execute function private.enforce_task_assignee_update_columns();

-- ---------------------------------------------------------------------------
-- RLS: assignees can update rows (trigger limits columns)
-- ---------------------------------------------------------------------------

drop policy if exists wedding_tasks_update on public.wedding_tasks;
create policy wedding_tasks_update on public.wedding_tasks
  for update to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'tasks.update')
    or private.is_task_assignee(id)
  )
  with check (
    private.has_wedding_permission(wedding_id, 'tasks.update')
    or private.is_task_assignee(id)
  );

-- ---------------------------------------------------------------------------
-- set_task_assignees (atomic replace)
-- ---------------------------------------------------------------------------

create or replace function public.set_task_assignees(
  p_task_id uuid,
  p_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wedding_id uuid;
  v_ids uuid[] := coalesce(p_user_ids, '{}');
  v_unique uuid[];
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select t.wedding_id into v_wedding_id
  from public.wedding_tasks t
  where t.id = p_task_id
  for update;

  if not found then
    raise exception 'task not found';
  end if;

  if not private.has_wedding_permission(v_wedding_id, 'tasks.assign') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct uid), '{}'::uuid[])
  into v_unique
  from unnest(v_ids) as uid
  where uid is not null;

  if exists (
    select 1 from unnest(v_unique) as uid
    where not exists (
      select 1 from public.wedding_members m
      where m.wedding_id = v_wedding_id and m.user_id = uid
    )
  ) then
    raise exception 'assignees must be members of this wedding';
  end if;

  delete from public.task_assignees a where a.task_id = p_task_id;

  insert into public.task_assignees (task_id, user_id, assigned_by)
  select p_task_id, uid, v_uid
  from unnest(v_unique) as uid;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', a.user_id,
        'assigned_at', a.assigned_at,
        'assigned_by', a.assigned_by
      )
      order by a.assigned_at, a.user_id
    ),
    '[]'::jsonb
  )
  into v_result
  from public.task_assignees a
  where a.task_id = p_task_id;

  perform private.log_activity(
    v_wedding_id,
    'task.assignees_set',
    'task',
    p_task_id,
    'tasks.view',
    jsonb_build_object('user_ids', to_jsonb(v_unique))
  );

  return v_result;
end;
$$;

revoke all on function public.set_task_assignees(uuid, uuid[]) from public, anon;
grant execute on function public.set_task_assignees(uuid, uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Task activity logging
-- ---------------------------------------------------------------------------

create or replace function private.log_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(
      new.wedding_id, 'task.created', 'task', new.id, 'tasks.view',
      jsonb_build_object('title', new.title, 'status', new.status)
    );
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
    into v_changed
    from jsonb_each(to_jsonb(new)) as n (key, value)
    where n.key not in ('updated_at', 'completed_at')
      and n.value is distinct from to_jsonb(old) -> n.key;

    if jsonb_array_length(v_changed) > 0 then
      perform private.log_activity(
        new.wedding_id, 'task.updated', 'task', new.id, 'tasks.view',
        jsonb_build_object('title', new.title, 'status', new.status, 'changed', v_changed)
      );
    end if;
  else
    perform private.log_activity(
      old.wedding_id, 'task.deleted', 'task', old.id, 'tasks.view',
      jsonb_build_object('title', old.title, 'status', old.status)
    );
  end if;
  return null;
end;
$$;

revoke all on function private.log_task_activity() from public, anon, authenticated;

drop trigger if exists wedding_tasks_log_activity on public.wedding_tasks;
create trigger wedding_tasks_log_activity
  after insert or update or delete on public.wedding_tasks
  for each row execute function private.log_task_activity();

create or replace function private.log_task_comment_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
begin
  if tg_op = 'DELETE' then
    select t.wedding_id into v_wedding_id from public.wedding_tasks t where t.id = old.task_id;
    if v_wedding_id is not null then
      perform private.log_activity(
        v_wedding_id, 'task.comment_deleted', 'task', old.task_id, 'tasks.view',
        jsonb_build_object('comment_id', old.id)
      );
    end if;
    return null;
  end if;

  select t.wedding_id into v_wedding_id from public.wedding_tasks t where t.id = new.task_id;
  if v_wedding_id is not null then
    perform private.log_activity(
      v_wedding_id, 'task.comment_added', 'task', new.task_id, 'tasks.view',
      jsonb_build_object('comment_id', new.id)
    );
  end if;
  return null;
end;
$$;

revoke all on function private.log_task_comment_activity() from public, anon, authenticated;

drop trigger if exists task_comments_log_activity on public.task_comments;
create trigger task_comments_log_activity
  after insert or delete on public.task_comments
  for each row execute function private.log_task_comment_activity();

-- ---------------------------------------------------------------------------
-- Task activity readable by anyone who can view the task (detail history)
-- ---------------------------------------------------------------------------

drop policy if exists wedding_activity_log_select on public.wedding_activity_log;
create policy wedding_activity_log_select on public.wedding_activity_log
  for select to authenticated
  using (
    private.is_wedding_owner(wedding_id)
    or (
      private.has_wedding_permission(wedding_id, 'activity.view')
      and (
        required_permission is null
        or private.has_wedding_permission(wedding_id, required_permission)
      )
    )
    or (
      entity_type = 'task'
      and private.has_wedding_permission(wedding_id, 'tasks.view')
      and required_permission = 'tasks.view'
    )
  );
