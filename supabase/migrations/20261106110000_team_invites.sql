-- Planning Team, Milestone 4: team invitation system.
-- Extends wedding_invites, adds create/resend/revoke/list/preview/accept RPCs,
-- including co-owner invites with the two-owner cap.
-- Legacy create_wedding_invite / accept_wedding_invite become thin wrappers.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

alter table public.wedding_invites
  add column if not exists invite_kind text not null default 'collaborator',
  add column if not exists permissions text[] not null default '{}',
  add column if not exists group_assignments jsonb not null default '[]'::jsonb,
  add column if not exists revoked_by uuid references public.profiles (id) on delete set null,
  add column if not exists last_sent_at timestamptz;

-- Generated normalized email for uniqueness while pending.
alter table public.wedding_invites
  add column if not exists invited_email_normalized text
    generated always as (nullif(lower(btrim(invited_email)), '')) stored;

alter table public.wedding_invites drop constraint if exists wedding_invites_invite_kind_check;
alter table public.wedding_invites
  add constraint wedding_invites_invite_kind_check
  check (invite_kind in ('collaborator', 'co_owner'));

alter table public.wedding_invites drop constraint if exists wedding_invites_role_check;
alter table public.wedding_invites
  add constraint wedding_invites_role_check
  check (
    (
      invite_kind = 'collaborator'
      and role in (
        'partner', 'planner', 'collaborator', 'viewer',
        'co_host', 'family_coordinator', 'task_manager', 'custom'
      )
    )
    or (invite_kind = 'co_owner' and role = 'owner')
  );

alter table public.wedding_invites drop constraint if exists wedding_invites_accepted_pair_check;
alter table public.wedding_invites
  add constraint wedding_invites_accepted_pair_check
  check ((accepted_by is null) = (accepted_at is null));

alter table public.wedding_invites drop constraint if exists wedding_invites_group_assignments_object_check;
alter table public.wedding_invites
  add constraint wedding_invites_group_assignments_object_check
  check (jsonb_typeof(group_assignments) = 'array');

-- One active (pending or expired-but-not-revoked) invite per email per wedding.
-- create_team_invite revokes expired rows for the address before inserting.
drop index if exists wedding_invites_pending_email_uidx;
create unique index wedding_invites_pending_email_uidx
  on public.wedding_invites (wedding_id, invited_email_normalized)
  where accepted_at is null and revoked_at is null and invited_email_normalized is not null;

-- At most one non-revoked, unaccepted co-owner invite row per wedding.
-- Expiry is enforced in create_team_invite (index predicates cannot use now()).
drop index if exists wedding_invites_pending_co_owner_uidx;
create unique index wedding_invites_pending_co_owner_uidx
  on public.wedding_invites (wedding_id)
  where invite_kind = 'co_owner'
    and accepted_at is null
    and revoked_at is null;

-- Revocation is RPC-only; drop the direct owner UPDATE policy and column grant.
drop policy if exists wedding_invites_update_owner on public.wedding_invites;
revoke update on table public.wedding_invites from authenticated;

revoke all on table public.wedding_invites from anon, authenticated;
grant select (
  id, wedding_id, invited_email, invited_phone, invited_email_normalized,
  role, invite_kind, permissions, group_assignments, invited_by,
  expires_at, accepted_by, accepted_at, revoked_at, revoked_by,
  last_sent_at, created_at
) on table public.wedding_invites to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.invite_status(
  p_accepted_at timestamptz,
  p_revoked_at timestamptz,
  p_expires_at timestamptz
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_accepted_at is not null then 'accepted'
    when p_revoked_at is not null then 'revoked'
    when p_expires_at <= now() then 'expired'
    else 'pending'
  end;
$$;

create or replace function private.mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    else left(split_part(p_email, '@', 1), 1)
      || '***@'
      || split_part(p_email, '@', 2)
  end;
$$;

create or replace function private.expand_permissions(p_keys text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_keys text[] := coalesce(p_keys, '{}');
  v_expanded text[] := '{}';
  v_pending text[];
  v_key text;
  v_req text;
  v_is_grantable boolean;
begin
  v_pending := v_keys;
  while coalesce(cardinality(v_pending), 0) > 0 loop
    v_key := v_pending[1];
    v_pending := v_pending[2:];

    if v_key is null or v_key = any (v_expanded) then
      continue;
    end if;

    select c.is_grantable into v_is_grantable
    from public.wedding_permission_catalog c
    where c.key = v_key;

    if not found then
      raise exception 'unknown permission: %', v_key using errcode = '22023';
    end if;
    if not v_is_grantable then
      raise exception 'permission % is not grantable', v_key using errcode = '42501';
    end if;

    v_expanded := array_append(v_expanded, v_key);

    for v_req in
      select unnest(c.requires)
      from public.wedding_permission_catalog c
      where c.key = v_key
    loop
      if v_req is not null and not (v_req = any (v_expanded)) and not (v_req = any (v_pending)) then
        v_pending := array_append(v_pending, v_req);
      end if;
    end loop;
  end loop;

  return v_expanded;
end;
$$;

create or replace function private.permissions_for_template(p_template text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(t.permission order by t.permission), '{}')
  from public.wedding_role_templates t
  where t.template = p_template;
$$;

create or replace function private.normalize_group_assignments(
  p_wedding_id uuid,
  p_assignments jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_group_id uuid;
  v_out jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
begin
  if p_assignments is null then
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'group_assignments must be an array' using errcode = '22P02';
  end if;

  for v_item in select * from jsonb_array_elements(p_assignments)
  loop
    if jsonb_typeof(v_item) <> 'object' or v_item ->> 'group_id' is null then
      raise exception 'each group assignment needs a group_id' using errcode = '22P02';
    end if;
    begin
      v_group_id := (v_item ->> 'group_id')::uuid;
    exception when others then
      raise exception 'invalid group_id in group_assignments' using errcode = '22P02';
    end;

    if v_group_id = any (v_seen) then
      continue;
    end if;

    if not exists (
      select 1 from public.guest_groups g
      where g.id = v_group_id and g.wedding_id = p_wedding_id
    ) then
      raise exception 'group does not belong to this wedding' using errcode = '23503';
    end if;

    v_seen := array_append(v_seen, v_group_id);
    v_out := v_out || jsonb_build_array(
      jsonb_build_object(
        'group_id', v_group_id,
        'can_delete', coalesce((v_item ->> 'can_delete')::boolean, false),
        'can_send_invitations', coalesce((v_item ->> 'can_send_invitations')::boolean, true)
      )
    );
  end loop;

  return v_out;
end;
$$;

create or replace function private.apply_invite_grants(
  p_wedding_id uuid,
  p_user_id uuid,
  p_permissions text[],
  p_group_assignments jsonb,
  p_granted_by uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perm text;
  v_item jsonb;
begin
  foreach v_perm in array coalesce(p_permissions, '{}')
  loop
    insert into public.wedding_member_permissions (wedding_id, user_id, permission, granted_by)
    values (p_wedding_id, p_user_id, v_perm, p_granted_by)
    on conflict do nothing;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_group_assignments, '[]'::jsonb))
  loop
    insert into public.guest_group_coordinators (
      wedding_id, group_id, user_id, can_delete, can_send_invitations, assigned_by
    ) values (
      p_wedding_id,
      (v_item ->> 'group_id')::uuid,
      p_user_id,
      coalesce((v_item ->> 'can_delete')::boolean, false),
      coalesce((v_item ->> 'can_send_invitations')::boolean, true),
      p_granted_by
    )
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function private.invite_status(timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function private.mask_email(text) from public, anon, authenticated;
revoke all on function private.expand_permissions(text[]) from public, anon, authenticated;
revoke all on function private.permissions_for_template(text) from public, anon, authenticated;
revoke all on function private.normalize_group_assignments(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.apply_invite_grants(uuid, uuid, text[], jsonb, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_team_invite
-- ---------------------------------------------------------------------------

create or replace function public.create_team_invite(
  p_wedding_id uuid,
  p_invited_email text,
  p_invite_kind text default 'collaborator',
  p_role_template text default 'collaborator',
  p_permissions text[] default null,
  p_group_assignments jsonb default '[]'::jsonb,
  p_expires_in interval default interval '7 days'
)
returns table (invite_id uuid, raw_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(p_invited_email)), '');
  v_kind text := coalesce(nullif(btrim(p_invite_kind), ''), 'collaborator');
  v_template text := coalesce(nullif(btrim(p_role_template), ''), 'collaborator');
  v_expires_in interval := coalesce(p_expires_in, interval '7 days');
  v_role text;
  v_permissions text[] := '{}';
  v_groups jsonb := '[]'::jsonb;
  v_token text;
  v_hash text;
  v_expires timestamptz;
  v_id uuid;
  v_owner_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can create invites';
  end if;
  if v_email is null then
    raise exception 'invited_email is required';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invited_email is not a valid email address';
  end if;
  if v_expires_in < interval '1 hour' or v_expires_in > interval '30 days' then
    raise exception 'invite expiry must be between 1 hour and 30 days';
  end if;
  if v_kind not in ('collaborator', 'co_owner') then
    raise exception 'invalid invite kind';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  if exists (
    select 1
    from public.wedding_members m
    join auth.users u on u.id = m.user_id
    where m.wedding_id = p_wedding_id and lower(u.email) = v_email
  ) then
    raise exception 'this person is already a member of this wedding';
  end if;

  -- Free unique pending slots held by expired-but-unrevoked rows for this wedding.
  update public.wedding_invites i
  set revoked_at = now(),
      revoked_by = v_uid
  where i.wedding_id = p_wedding_id
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at <= now()
    and (
      i.invited_email_normalized = v_email
      or (v_kind = 'co_owner' and i.invite_kind = 'co_owner')
    );

  if exists (
    select 1 from public.wedding_invites i
    where i.wedding_id = p_wedding_id
      and i.invited_email_normalized = v_email
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  ) then
    raise exception 'a pending invite already exists for this email';
  end if;

  if v_kind = 'co_owner' then
    select count(*) into v_owner_count
    from public.wedding_members m
    where m.wedding_id = p_wedding_id and m.role = 'owner';
    if v_owner_count >= 2 then
      raise exception 'this wedding already has two owners';
    end if;
    if exists (
      select 1 from public.wedding_invites i
      where i.wedding_id = p_wedding_id
        and i.invite_kind = 'co_owner'
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now()
    ) then
      raise exception 'a pending co-owner invite already exists';
    end if;
    v_role := 'owner';
    v_permissions := '{}';
    v_groups := '[]'::jsonb;
  else
    if v_template not in (
      'partner', 'planner', 'collaborator', 'viewer',
      'co_host', 'family_coordinator', 'task_manager', 'custom'
    ) then
      raise exception 'invalid invite role';
    end if;
    v_role := v_template;
    if p_permissions is null then
      v_permissions := private.permissions_for_template(v_template);
    else
      v_permissions := private.expand_permissions(p_permissions);
    end if;
    v_groups := private.normalize_group_assignments(p_wedding_id, p_group_assignments);
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires := now() + v_expires_in;

  insert into public.wedding_invites (
    wedding_id, invited_email, invited_phone, role, invite_kind,
    permissions, group_assignments, token_hash, invited_by, expires_at, last_sent_at
  ) values (
    p_wedding_id, v_email, null, v_role, v_kind,
    v_permissions, v_groups, v_hash, v_uid, v_expires, now()
  )
  returning id into v_id;

  perform private.log_activity(
    p_wedding_id,
    'invite.created',
    'invite',
    v_id,
    'team.view',
    jsonb_build_object(
      'invite_kind', v_kind,
      'role', v_role,
      'invited_email_masked', private.mask_email(v_email)
    )
  );

  invite_id := v_id;
  raw_token := v_token;
  expires_at := v_expires;
  return next;
end;
$$;

revoke all on function public.create_team_invite(uuid, text, text, text, text[], jsonb, interval)
  from public, anon;
grant execute on function public.create_team_invite(uuid, text, text, text, text[], jsonb, interval)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- resend / revoke / list
-- ---------------------------------------------------------------------------

create or replace function public.resend_team_invite(
  p_invite_id uuid,
  p_expires_in interval default interval '7 days'
)
returns table (invite_id uuid, raw_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.wedding_invites;
  v_expires_in interval := coalesce(p_expires_in, interval '7 days');
  v_token text;
  v_hash text;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if v_expires_in < interval '1 hour' or v_expires_in > interval '30 days' then
    raise exception 'invite expiry must be between 1 hour and 30 days';
  end if;

  select * into v_invite
  from public.wedding_invites i
  where i.id = p_invite_id
  for update;

  if not found then
    raise exception 'invite not found';
  end if;
  if not private.is_wedding_owner(v_invite.wedding_id) then
    raise exception 'only wedding owners can resend invites';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite has already been used';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite has been revoked';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires := now() + v_expires_in;

  update public.wedding_invites i
  set token_hash = v_hash,
      expires_at = v_expires,
      last_sent_at = now()
  where i.id = v_invite.id;

  perform private.log_activity(
    v_invite.wedding_id,
    'invite.resent',
    'invite',
    v_invite.id,
    'team.view',
    jsonb_build_object('invited_email_masked', private.mask_email(v_invite.invited_email))
  );

  invite_id := v_invite.id;
  raw_token := v_token;
  expires_at := v_expires;
  return next;
end;
$$;

create or replace function public.revoke_team_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.wedding_invites;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select * into v_invite
  from public.wedding_invites i
  where i.id = p_invite_id
  for update;

  if not found then
    raise exception 'invite not found';
  end if;
  if not private.is_wedding_owner(v_invite.wedding_id) then
    raise exception 'only wedding owners can revoke invites';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite has already been used';
  end if;
  if v_invite.revoked_at is not null then
    return;
  end if;

  update public.wedding_invites i
  set revoked_at = now(),
      revoked_by = v_uid
  where i.id = v_invite.id;

  perform private.log_activity(
    v_invite.wedding_id,
    'invite.revoked',
    'invite',
    v_invite.id,
    'team.view',
    jsonb_build_object('invited_email_masked', private.mask_email(v_invite.invited_email))
  );
end;
$$;

create or replace function public.list_team_invites(p_wedding_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can list invites';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'invited_email', i.invited_email,
        'invited_email_masked', private.mask_email(i.invited_email),
        'role', i.role,
        'invite_kind', i.invite_kind,
        'status', private.invite_status(i.accepted_at, i.revoked_at, i.expires_at),
        'expires_at', i.expires_at,
        'created_at', i.created_at,
        'last_sent_at', i.last_sent_at,
        'accepted_at', i.accepted_at,
        'revoked_at', i.revoked_at,
        'invited_by', i.invited_by
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.wedding_invites i
  where i.wedding_id = p_wedding_id;

  return v_result;
end;
$$;

revoke all on function public.resend_team_invite(uuid, interval) from public, anon;
revoke all on function public.revoke_team_invite(uuid) from public, anon;
revoke all on function public.list_team_invites(uuid) from public, anon;
grant execute on function public.resend_team_invite(uuid, interval) to authenticated, service_role;
grant execute on function public.revoke_team_invite(uuid) to authenticated, service_role;
grant execute on function public.list_team_invites(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preview (anon allowed — decision D12) and accept
-- ---------------------------------------------------------------------------

create or replace function public.get_team_invite_preview(p_raw_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_invite public.wedding_invites;
  v_title text;
  v_inviter text;
begin
  if p_raw_token is null or length(p_raw_token) = 0 then
    raise exception 'token is required';
  end if;

  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.wedding_invites i
  where i.token_hash = v_hash;

  if not found then
    raise exception 'invalid invite token';
  end if;

  select w.title into v_title
  from public.weddings w
  where w.id = v_invite.wedding_id;

  select coalesce(nullif(btrim(p.display_name), ''), 'Someone')
  into v_inviter
  from public.profiles p
  where p.id = v_invite.invited_by;

  return jsonb_build_object(
    'invite_id', v_invite.id,
    'wedding_id', v_invite.wedding_id,
    'wedding_title', coalesce(v_title, 'A celebration'),
    'inviter_name', coalesce(v_inviter, 'Someone'),
    'role', v_invite.role,
    'invite_kind', v_invite.invite_kind,
    'expires_at', v_invite.expires_at,
    'invited_email_masked', private.mask_email(v_invite.invited_email),
    'status', private.invite_status(v_invite.accepted_at, v_invite.revoked_at, v_invite.expires_at)
  );
end;
$$;

create or replace function public.accept_team_invite(p_raw_token text)
returns public.wedding_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_invite public.wedding_invites;
  v_member public.wedding_members;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_owner_count integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_raw_token is null or length(p_raw_token) = 0 then
    raise exception 'token is required';
  end if;

  v_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.wedding_invites i
  where i.token_hash = v_hash
  for update;

  if not found then
    raise exception 'invalid invite token';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite has been revoked';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite has already been used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite has expired';
  end if;
  if v_invite.invited_email is null then
    raise exception 'this invite cannot be accepted until phone sign-in is available';
  end if;

  select lower(u.email), u.email_confirmed_at
  into v_email, v_email_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if v_email_confirmed_at is null then
    raise exception 'confirm your email address before accepting this invite';
  end if;
  if v_email is distinct from lower(btrim(v_invite.invited_email)) then
    raise exception 'this invite was sent to a different email address';
  end if;

  perform 1 from public.weddings w where w.id = v_invite.wedding_id for update;

  if exists (
    select 1 from public.wedding_members m
    where m.wedding_id = v_invite.wedding_id and m.user_id = v_uid
  ) then
    raise exception 'you are already a member of this wedding';
  end if;

  if v_invite.invite_kind = 'co_owner' then
    select count(*) into v_owner_count
    from public.wedding_members m
    where m.wedding_id = v_invite.wedding_id and m.role = 'owner';
    if v_owner_count >= 2 then
      raise exception 'this wedding already has two owners';
    end if;
    perform set_config('kiburan.allow_owner_change', 'on', true);
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  insert into public.wedding_members (wedding_id, user_id, role, invited_by)
  values (v_invite.wedding_id, v_uid, v_invite.role, v_invite.invited_by)
  returning * into v_member;

  if v_invite.invite_kind = 'collaborator' then
    perform private.apply_invite_grants(
      v_invite.wedding_id,
      v_uid,
      v_invite.permissions,
      v_invite.group_assignments,
      v_invite.invited_by
    );
  end if;

  update public.wedding_invites i
  set accepted_by = v_uid,
      accepted_at = now()
  where i.id = v_invite.id;

  perform private.log_activity(
    v_invite.wedding_id,
    'invite.accepted',
    'invite',
    v_invite.id,
    'team.view',
    jsonb_build_object(
      'user_id', v_uid,
      'role', v_invite.role,
      'invite_kind', v_invite.invite_kind
    )
  );

  return v_member;
end;
$$;

revoke all on function public.get_team_invite_preview(text) from public;
grant execute on function public.get_team_invite_preview(text) to anon, authenticated, service_role;

revoke all on function public.accept_team_invite(text) from public, anon;
grant execute on function public.accept_team_invite(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Legacy wrappers (no app callers; keep names for older tests / types)
-- ---------------------------------------------------------------------------

create or replace function public.create_wedding_invite(
  p_wedding_id uuid,
  p_role text default 'collaborator',
  p_invited_email text default null,
  p_invited_phone text default null,
  p_expires_in interval default interval '7 days'
)
returns table (invite_id uuid, raw_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_invited_phone is not null and nullif(btrim(p_invited_phone), '') is not null
     and (p_invited_email is null or length(btrim(p_invited_email)) = 0) then
    raise exception 'invited_email is required';
  end if;

  return query
  select *
  from public.create_team_invite(
    p_wedding_id,
    p_invited_email,
    'collaborator',
    coalesce(p_role, 'collaborator'),
    null,
    '[]'::jsonb,
    p_expires_in
  );
end;
$$;

create or replace function public.accept_wedding_invite(p_raw_token text)
returns public.wedding_members
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.accept_team_invite(p_raw_token);
end;
$$;

revoke all on function public.create_wedding_invite(uuid, text, text, text, interval) from public, anon;
grant execute on function public.create_wedding_invite(uuid, text, text, text, interval)
  to authenticated, service_role;
revoke all on function public.accept_wedding_invite(text) from public, anon;
grant execute on function public.accept_wedding_invite(text) to authenticated, service_role;
