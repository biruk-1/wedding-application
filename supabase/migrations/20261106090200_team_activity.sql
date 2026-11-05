-- Planning Team, Milestone 2 (3 of 3): activity history and guest attribution.
-- Owners can see who added and changed every guest; other members see activity only with
-- activity.view plus the permission each entry requires. Clients cannot write the log.

-- ---------------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------------

create table public.wedding_activity_log (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id uuid,
  required_permission text references public.wedding_permission_catalog (key),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);

create index wedding_activity_log_wedding_created_idx
  on public.wedding_activity_log (wedding_id, created_at desc);

comment on table public.wedding_activity_log is
  'Append-only Planning Team activity. Summaries never hold guest contact details or money amounts.';

alter table public.wedding_activity_log enable row level security;
revoke all on table public.wedding_activity_log from anon, authenticated;
grant select on table public.wedding_activity_log to authenticated;

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
  );

create or replace function private.log_activity(
  p_wedding_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_required_permission text,
  p_summary jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows removed by a wedding delete cascade have nothing left to log against.
  if p_wedding_id is null
    or not exists (select 1 from public.weddings w where w.id = p_wedding_id) then
    return;
  end if;

  insert into public.wedding_activity_log (
    wedding_id, actor_id, action, entity_type, entity_id, required_permission, summary
  ) values (
    p_wedding_id, auth.uid(), p_action, p_entity_type, p_entity_id,
    p_required_permission, coalesce(p_summary, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.log_activity(uuid, text, text, uuid, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guest and group attribution
-- ---------------------------------------------------------------------------

alter table public.guests
  add column created_by uuid references public.profiles (id) on delete set null,
  add column updated_by uuid references public.profiles (id) on delete set null,
  add column updated_at timestamptz;

alter table public.guest_groups
  add column created_by uuid references public.profiles (id) on delete set null;

create index guests_group_id_idx on public.guests (group_id);

-- Signed-in callers are always recorded as themselves; admin imports (no auth.uid()) may supply values.
create or replace function private.set_guest_attribution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(v_uid, new.created_by);
    new.updated_by := coalesce(v_uid, new.updated_by, new.created_by);
    new.updated_at := now();
  else
    new.created_by := old.created_by;
    new.updated_by := v_uid;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.set_guest_attribution() from public, anon, authenticated;

create trigger guests_set_attribution
  before insert or update on public.guests
  for each row execute function private.set_guest_attribution();

create or replace function private.set_guest_group_attribution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

revoke all on function private.set_guest_group_attribution() from public, anon, authenticated;

create trigger guest_groups_set_attribution
  before insert or update on public.guest_groups
  for each row execute function private.set_guest_group_attribution();

-- ---------------------------------------------------------------------------
-- Guest and group activity. Summaries carry names and changed field names only.
-- ---------------------------------------------------------------------------

create or replace function private.log_guest_activity()
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
      new.wedding_id, 'guest.created', 'guest', new.id, 'guests.view',
      jsonb_build_object('full_name', new.full_name, 'group_id', new.group_id)
    );
  elsif tg_op = 'UPDATE' then
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb)
    into v_changed
    from jsonb_each(to_jsonb(new)) as n (key, value)
    where n.key not in ('updated_at', 'updated_by')
      and n.value is distinct from to_jsonb(old) -> n.key;

    if jsonb_array_length(v_changed) > 0 then
      perform private.log_activity(
        new.wedding_id, 'guest.updated', 'guest', new.id, 'guests.view',
        jsonb_build_object('full_name', new.full_name, 'group_id', new.group_id, 'changed', v_changed)
      );
    end if;
  else
    perform private.log_activity(
      old.wedding_id, 'guest.deleted', 'guest', old.id, 'guests.view',
      jsonb_build_object('full_name', old.full_name, 'group_id', old.group_id)
    );
  end if;
  return null;
end;
$$;

revoke all on function private.log_guest_activity() from public, anon, authenticated;

create trigger guests_log_activity
  after insert or update or delete on public.guests
  for each row execute function private.log_guest_activity();

create or replace function private.log_guest_group_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(
      new.wedding_id, 'guest_group.created', 'guest_group', new.id, 'guests.view',
      jsonb_build_object('name', new.name, 'side', new.side)
    );
  elsif tg_op = 'UPDATE' then
    if (new.name, new.side, new.notes) is distinct from (old.name, old.side, old.notes) then
      perform private.log_activity(
        new.wedding_id, 'guest_group.updated', 'guest_group', new.id, 'guests.view',
        jsonb_build_object('name', new.name, 'side', new.side)
      );
    end if;
  else
    perform private.log_activity(
      old.wedding_id, 'guest_group.deleted', 'guest_group', old.id, 'guests.view',
      jsonb_build_object('name', old.name, 'side', old.side)
    );
  end if;
  return null;
end;
$$;

revoke all on function private.log_guest_group_activity() from public, anon, authenticated;

create trigger guest_groups_log_activity
  after insert or update or delete on public.guest_groups
  for each row execute function private.log_guest_group_activity();
