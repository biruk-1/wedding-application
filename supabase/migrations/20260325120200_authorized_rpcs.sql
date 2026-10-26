-- Privileged RPCs: wedding creation, collaborator invites, invite acceptance.
-- Clients must not insert weddings / wedding_members / wedding_invites.token_hash directly.

create or replace function public.create_wedding(
  p_title text,
  p_partner_one_name text,
  p_partner_two_name text,
  p_wedding_date date default null,
  p_city text default null,
  p_country_code char(2) default 'ET',
  p_timezone text default 'Africa/Addis_Ababa',
  p_style text default null,
  p_currency_code char(3) default 'ETB',
  p_estimated_guest_count integer default null
)
returns public.weddings
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_wedding public.weddings;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'title is required';
  end if;
  if p_partner_one_name is null or length(trim(p_partner_one_name)) = 0 then
    raise exception 'partner_one_name is required';
  end if;
  if p_partner_two_name is null or length(trim(p_partner_two_name)) = 0 then
    raise exception 'partner_two_name is required';
  end if;

  -- Ensure profile exists (covers edge cases before trigger, and test inserts)
  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  insert into public.weddings (
    created_by, title, partner_one_name, partner_two_name, wedding_date,
    city, country_code, timezone, style, currency_code, estimated_guest_count
  ) values (
    v_uid, trim(p_title), trim(p_partner_one_name), trim(p_partner_two_name), p_wedding_date,
    p_city, coalesce(p_country_code, 'ET'), coalesce(p_timezone, 'Africa/Addis_Ababa'),
    p_style, coalesce(p_currency_code, 'ETB'), p_estimated_guest_count
  )
  returning * into v_wedding;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_wedding.id, v_uid, 'owner');

  insert into public.wedding_budgets (wedding_id, currency_code)
  values (v_wedding.id, v_wedding.currency_code);

  return v_wedding;
end;
$$;

revoke all on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer
) from public;
grant execute on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer
) to authenticated;

-- Create a collaborator invite; returns the raw token once. Only owners.
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
set search_path = public, extensions, private
as $$
declare
  v_uid uuid := auth.uid();
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
  if p_invited_email is null and p_invited_phone is null then
    raise exception 'invited_email or invited_phone is required';
  end if;
  if p_role is null or p_role not in ('partner', 'planner', 'collaborator', 'viewer') then
    raise exception 'invalid invite role';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := now() + coalesce(p_expires_in, interval '7 days');

  insert into public.wedding_invites (
    wedding_id, invited_email, invited_phone, role, token_hash, invited_by, expires_at
  ) values (
    p_wedding_id, p_invited_email, p_invited_phone, p_role, v_hash, v_uid, v_expires
  )
  returning id into v_id;

  invite_id := v_id;
  raw_token := v_token;
  expires_at := v_expires;
  return next;
end;
$$;

revoke all on function public.create_wedding_invite(uuid, text, text, text, interval) from public;
grant execute on function public.create_wedding_invite(uuid, text, text, text, interval) to authenticated;

-- Accept a collaborator invite with the raw token (single-use).
-- PROVISIONAL: email/phone match is NOT enforced (audit Q4). Documented as a gap.
create or replace function public.accept_wedding_invite(p_raw_token text)
returns public.wedding_members
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_invite public.wedding_invites;
  v_member public.wedding_members;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_raw_token is null or length(p_raw_token) = 0 then
    raise exception 'token is required';
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

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

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_invite.wedding_id, v_uid, v_invite.role)
  on conflict (wedding_id, user_id) do update
    set role = excluded.role
  returning * into v_member;

  update public.wedding_invites
  set accepted_by = v_uid,
      accepted_at = now()
  where id = v_invite.id;

  return v_member;
end;
$$;

revoke all on function public.accept_wedding_invite(text) from public;
grant execute on function public.accept_wedding_invite(text) to authenticated;

-- Owner-only membership role change. Cannot demote/remove the last owner via this path.
create or replace function public.set_wedding_member_role(
  p_wedding_id uuid,
  p_user_id uuid,
  p_role text
)
returns public.wedding_members
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_member public.wedding_members;
  v_owner_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not private.is_wedding_owner(p_wedding_id) then
    raise exception 'only wedding owners can change membership roles';
  end if;
  if p_role is null or p_role not in ('owner', 'partner', 'planner', 'collaborator', 'viewer') then
    raise exception 'invalid role';
  end if;

  if p_role <> 'owner' then
    select count(*) into v_owner_count
    from public.wedding_members m
    where m.wedding_id = p_wedding_id and m.role = 'owner' and m.user_id <> p_user_id;
    if v_owner_count = 0 then
      raise exception 'cannot remove the last owner';
    end if;
  end if;

  update public.wedding_members
  set role = p_role
  where wedding_id = p_wedding_id and user_id = p_user_id
  returning * into v_member;

  if not found then
    raise exception 'member not found';
  end if;
  return v_member;
end;
$$;

revoke all on function public.set_wedding_member_role(uuid, uuid, text) from public;
grant execute on function public.set_wedding_member_role(uuid, uuid, text) to authenticated;
