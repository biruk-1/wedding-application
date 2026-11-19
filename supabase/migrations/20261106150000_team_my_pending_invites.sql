-- Milestone 9 polish: invitee inbox — list + accept pending team invites by invite id
-- (email-bound; no raw token required once the invited account is signed in).

create or replace function public.list_my_pending_team_invites()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  if v_email is null or length(v_email) = 0 then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'wedding_id', i.wedding_id,
        'wedding_title', coalesce(w.title, 'A celebration'),
        'role', i.role,
        'invite_kind', i.invite_kind,
        'status', private.invite_status(i.accepted_at, i.revoked_at, i.expires_at),
        'expires_at', i.expires_at,
        'created_at', i.created_at,
        'inviter_name', coalesce(nullif(p.display_name, ''), 'Someone')
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.wedding_invites i
  join public.weddings w on w.id = i.wedding_id
  left join public.profiles p on p.id = i.invited_by
  where i.invited_email_normalized = v_email
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
    and not exists (
      select 1 from public.wedding_members m
      where m.wedding_id = i.wedding_id and m.user_id = v_uid
    );

  return v_result;
end;
$$;

comment on function public.list_my_pending_team_invites() is
  'Pending Planning Team invites addressed to the signed-in user email.';

create or replace function public.accept_my_team_invite(p_invite_id uuid)
returns public.wedding_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.wedding_invites;
  v_email text;
  v_email_confirmed_at timestamptz;
  v_owner_count integer;
  v_member public.wedding_members;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_invite_id is null then
    raise exception 'invite id is required';
  end if;

  select * into v_invite
  from public.wedding_invites i
  where i.id = p_invite_id
  for update;

  if not found then
    raise exception 'invalid invite';
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
      'invite_kind', v_invite.invite_kind,
      'via', 'inbox'
    )
  );

  return v_member;
end;
$$;

comment on function public.accept_my_team_invite(uuid) is
  'Accept a pending Planning Team invite addressed to the caller email (no raw token).';

revoke all on function public.list_my_pending_team_invites() from public, anon;
revoke all on function public.accept_my_team_invite(uuid) from public, anon;
grant execute on function public.list_my_pending_team_invites() to authenticated, service_role;
grant execute on function public.accept_my_team_invite(uuid) to authenticated, service_role;
