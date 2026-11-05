-- Planning Team, Milestone 2 (1 of 3): security hardening the collaboration model depends on.
-- Resolves audit findings F1, F2, F3 (recipient binding, duplicates, expiry bounds), F4, F9 (created_by only),
-- F10 and F11 from docs/planning-team/04-rls-and-security-audit.md.
-- Does not change reference/kiburan_schema.sql or any table shape.

-- ---------------------------------------------------------------------------
-- F1: token hashes must not be readable or writable by API roles.
-- Column-level revokes do not override table-level grants, so table grants are replaced
-- with explicit column grants. Inserts go through SECURITY DEFINER RPCs only.
-- ---------------------------------------------------------------------------

revoke all on table public.wedding_invites from anon, authenticated;
grant select (
  id, wedding_id, invited_email, invited_phone, role, invited_by,
  expires_at, accepted_by, accepted_at, revoked_at, created_at
) on table public.wedding_invites to authenticated;
grant update (revoked_at) on table public.wedding_invites to authenticated;

revoke all on table public.invitations from anon, authenticated;
grant select (
  id, wedding_id, group_id, guest_id, design_id, delivery_channel, status,
  sent_at, delivered_at, opened_at, created_at
) on table public.invitations to authenticated;
grant update (status) on table public.invitations to authenticated;
grant delete on table public.invitations to authenticated;

-- ---------------------------------------------------------------------------
-- F9 (partial): the wedding creator is an audit fact and cannot be reassigned.
-- Owner-only settings writes are part of Milestone 5.
-- ---------------------------------------------------------------------------

create or replace function private.protect_wedding_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'weddings.created_by cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_wedding_created_by() from public, anon, authenticated;

drop trigger if exists weddings_protect_created_by on public.weddings;
create trigger weddings_protect_created_by
  before update of created_by on public.weddings
  for each row execute function private.protect_wedding_created_by();

-- ---------------------------------------------------------------------------
-- F10: timeline assignees must belong to the event's wedding.
-- ---------------------------------------------------------------------------

create or replace function private.assert_timeline_assignee_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wedding_id uuid;
begin
  if new.assigned_to is null then
    return new;
  end if;

  select e.wedding_id into v_wedding_id
  from public.wedding_events e
  where e.id = new.event_id;

  if v_wedding_id is null or not exists (
    select 1 from public.wedding_members m
    where m.wedding_id = v_wedding_id and m.user_id = new.assigned_to
  ) then
    raise exception 'timeline assignee must be a member of this wedding' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.assert_timeline_assignee_member() from public, anon, authenticated;

drop trigger if exists timeline_items_assignee_member on public.timeline_items;
create trigger timeline_items_assignee_member
  before insert or update of assigned_to, event_id on public.timeline_items
  for each row execute function private.assert_timeline_assignee_member();

-- ---------------------------------------------------------------------------
-- F4: role changes cannot create, remove or demote owners. Ownership changes get a
-- dedicated confirmation workflow in Milestone 5.
-- ---------------------------------------------------------------------------

create or replace function public.set_wedding_member_role(
  p_wedding_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.wedding_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.wedding_members;
  v_target_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can change membership roles';
  end if;
  if p_role = 'owner' then
    raise exception 'ownership can only change through the ownership workflow';
  end if;
  if p_role is null or p_role not in ('partner', 'planner', 'collaborator', 'viewer') then
    raise exception 'invalid role';
  end if;

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  select m.role into v_target_role
  from public.wedding_members m
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  for update;

  if not found then
    raise exception 'member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'ownership can only change through the ownership workflow';
  end if;

  update public.wedding_members m
  set role = p_role
  where m.wedding_id = p_wedding_id and m.user_id = p_user_id
  returning * into v_member;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- F3: invites are email-bound (decision D5), normalized, unique while pending and
-- bounded in lifetime. Phone-only invites wait for phone sign-in.
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
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(p_invited_email)), '');
  v_expires_in interval := coalesce(p_expires_in, interval '7 days');
  v_token text;
  v_hash text;
  v_expires timestamptz;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can create invites';
  end if;
  if p_role is null or p_role not in ('partner', 'planner', 'collaborator', 'viewer') then
    raise exception 'invalid invite role';
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

  perform 1 from public.weddings w where w.id = p_wedding_id for update;

  if exists (
    select 1
    from public.wedding_members m
    join auth.users u on u.id = m.user_id
    where m.wedding_id = p_wedding_id and lower(u.email) = v_email
  ) then
    raise exception 'this person is already a member of this wedding';
  end if;
  if exists (
    select 1 from public.wedding_invites i
    where i.wedding_id = p_wedding_id
      and lower(btrim(i.invited_email)) = v_email
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > now()
  ) then
    raise exception 'a pending invite already exists for this email';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires := now() + v_expires_in;

  insert into public.wedding_invites (
    wedding_id, invited_email, invited_phone, role, token_hash, invited_by, expires_at
  ) values (
    p_wedding_id, v_email, nullif(btrim(p_invited_phone), ''), p_role, v_hash, v_uid, v_expires
  )
  returning id into v_id;

  invite_id := v_id;
  raw_token := v_token;
  expires_at := v_expires;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- F2 + F3: acceptance is bound to the invited, confirmed email and never changes an
-- existing membership (so it cannot downgrade an owner or leave a wedding ownerless).
-- ---------------------------------------------------------------------------

create or replace function public.accept_wedding_invite(p_raw_token text)
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

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_invite.wedding_id, v_uid, v_invite.role)
  returning * into v_member;

  update public.wedding_invites i
  set accepted_by = v_uid,
      accepted_at = now()
  where i.id = v_invite.id;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- F11: anonymous callers cannot execute authenticated-only RPCs. Guest RSVP token
-- RPCs (get_guest_invitation_by_token, submit_guest_invitation_rsvp) stay anonymous by design.
-- ---------------------------------------------------------------------------

revoke execute on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
) from public, anon;
revoke execute on function public.create_wedding_invite(uuid, text, text, text, interval) from public, anon;
revoke execute on function public.accept_wedding_invite(text) from public, anon;
revoke execute on function public.set_wedding_member_role(uuid, uuid, text) from public, anon;
revoke execute on function public.create_guest_invitation(uuid, uuid, uuid, uuid, uuid[], text) from public, anon;
revoke execute on function public.mark_guest_invitation_sent(uuid) from public, anon;
