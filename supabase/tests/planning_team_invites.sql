-- Planning Team invitation RPCs (Milestone 4).
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_invites.sql

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
  update public.profiles set display_name = split_part(p_email, '@', 1) where id = v_id;
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
  u_owner uuid := pg_temp.make_user('m4-owner@kiburan.test');
  u_owner2 uuid := pg_temp.make_user('m4-owner2@kiburan.test');
  u_join uuid := pg_temp.make_user('m4-join@kiburan.test');
  u_wrong uuid := pg_temp.make_user('m4-wrong@kiburan.test');
  u_co uuid := pg_temp.make_user('m4-coowner@kiburan.test');
  u_coord uuid := pg_temp.make_user('m4-coord@kiburan.test');
  u_inbox uuid := pg_temp.make_user('m4-inbox@kiburan.test');
  w uuid;
  v_group uuid;
  v_invite_id uuid;
  v_token text;
  v_token2 text;
  v_preview jsonb;
  v_list jsonb;
  v_member public.wedding_members;
  v_count integer;
  v_role text;
begin
  perform pg_temp.as_user(u_owner);
  select id into w from public.create_wedding('M4 Wedding', 'Selam', 'Dawit');

  perform pg_temp.as_admin();
  insert into public.guest_groups (wedding_id, name, side)
  values (w, 'Bride family', 'partner_one')
  returning id into v_group;

  ---------------------------------------------------------------------------
  -- Create collaborator invite with template + groups
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(
    w,
    '  M4-Join@Kiburan.TEST ',
    'collaborator',
    'family_coordinator',
    null,
    jsonb_build_array(
      jsonb_build_object('group_id', v_group, 'can_delete', true, 'can_send_invitations', true)
    ),
    interval '2 days'
  );

  perform pg_temp.check('create returns token', v_token is not null);
  perform pg_temp.expect_error('duplicate pending invite',
    format('select * from public.create_team_invite(%L, %L)', w, 'm4-join@kiburan.test'),
    '%pending invite already exists%');
  perform pg_temp.expect_error('reserved permission rejected',
    format(
      'select * from public.create_team_invite(%L, %L, %L, %L, %L::text[])',
      w, 'm4-x@kiburan.test', 'collaborator', 'custom', array['team.invite']
    ),
    '%not grantable%');
  perform pg_temp.expect_error('foreign group rejected',
    format(
      'select * from public.create_team_invite(%L, %L, %L, %L, null, %L::jsonb)',
      w, 'm4-y@kiburan.test', 'collaborator', 'viewer',
      jsonb_build_array(jsonb_build_object('group_id', gen_random_uuid()))
    ),
    '%does not belong%');

  ---------------------------------------------------------------------------
  -- Preview (anon) + wrong account + accept
  ---------------------------------------------------------------------------

  perform pg_temp.as_anon();
  v_preview := public.get_team_invite_preview(v_token);
  perform pg_temp.check('anon preview',
    v_preview ->> 'status' = 'pending'
    and v_preview ->> 'role' = 'family_coordinator'
    and v_preview ->> 'invited_email_masked' like 'm***@%'
    and v_preview ? 'wedding_title');

  perform pg_temp.as_user(u_wrong);
  perform pg_temp.expect_error('wrong email rejected',
    format('select public.accept_team_invite(%L)', v_token),
    '%different email address%');

  perform pg_temp.as_admin();
  select count(*) into v_count from public.wedding_invites
  where id = v_invite_id and accepted_at is null;
  perform pg_temp.check('wrong account does not consume invite', v_count = 1);

  perform pg_temp.as_user(u_join);
  select * into v_member from public.accept_team_invite(v_token);
  perform pg_temp.check('accept creates membership',
    v_member.user_id = u_join and v_member.role = 'family_coordinator');

  select count(*) into v_count from public.wedding_member_permissions
  where wedding_id = w and user_id = u_join and permission = 'team.view';
  perform pg_temp.check('template permissions applied', v_count = 1);
  select count(*) into v_count from public.guest_group_coordinators
  where wedding_id = w and user_id = u_join and group_id = v_group and can_delete;
  perform pg_temp.check('group assignment applied', v_count = 1);

  perform pg_temp.expect_error('reuse rejected',
    format('select public.accept_team_invite(%L)', v_token),
    '%already been used%');

  -- Existing members cannot receive a second invite (and therefore cannot be downgraded).
  perform pg_temp.as_user(u_owner);
  perform pg_temp.expect_error('existing member cannot be re-invited',
    format('select * from public.create_team_invite(%L, %L, %L, %L)',
      w, 'm4-owner@kiburan.test', 'collaborator', 'viewer'),
    '%already a member%');
  perform pg_temp.as_admin();
  select role into v_role from public.wedding_members where wedding_id = w and user_id = u_owner;
  perform pg_temp.check('owner role unchanged', v_role = 'owner');

  ---------------------------------------------------------------------------
  -- Resend, revoke, list, expiry
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm4-coord@kiburan.test', 'collaborator', 'task_manager');

  select invite_id, raw_token into v_invite_id, v_token2
  from public.resend_team_invite(v_invite_id, interval '3 days');
  perform pg_temp.check('resend rotates token', v_token2 is distinct from v_token);

  perform pg_temp.as_user(u_coord);
  perform pg_temp.expect_error('old token invalid after resend',
    format('select public.accept_team_invite(%L)', v_token),
    '%invalid invite token%');

  perform pg_temp.as_user(u_owner);
  perform public.revoke_team_invite(v_invite_id);
  perform pg_temp.as_user(u_coord);
  perform pg_temp.expect_error('revoked invite rejected',
    format('select public.accept_team_invite(%L)', v_token2),
    '%revoked%');

  perform pg_temp.as_user(u_owner);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm4-coord@kiburan.test', 'collaborator', 'viewer');
  perform pg_temp.as_admin();
  update public.wedding_invites set expires_at = now() - interval '1 minute' where id = v_invite_id;
  perform pg_temp.as_user(u_coord);
  perform pg_temp.expect_error('expired invite rejected',
    format('select public.accept_team_invite(%L)', v_token),
    '%expired%');

  -- Expired row is auto-revoked so a fresh invite can be created.
  perform pg_temp.as_user(u_owner);
  select invite_id into v_invite_id
  from public.create_team_invite(w, 'm4-coord@kiburan.test', 'collaborator', 'viewer');
  perform pg_temp.check('re-invite after expiry', v_invite_id is not null);

  v_list := public.list_team_invites(w);
  perform pg_temp.check('owner lists invites without hashes',
    jsonb_array_length(v_list) > 0
    and not exists (
      select 1 from jsonb_array_elements(v_list) e where e ? 'token_hash' or e ? 'raw_token'
    ));

  perform pg_temp.as_user(u_join);
  perform pg_temp.expect_error('non-owner cannot list invites',
    format('select public.list_team_invites(%L)', w),
    '%only wedding owners%');
  perform pg_temp.expect_error('direct invite update denied',
    format('update public.wedding_invites set revoked_at = now() where wedding_id = %L', w),
    'permission denied%');

  ---------------------------------------------------------------------------
  -- Co-owner invite
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm4-coowner@kiburan.test', 'co_owner');

  perform pg_temp.expect_error('second co-owner invite blocked',
    format('select * from public.create_team_invite(%L, %L, %L)', w, 'm4-owner2@kiburan.test', 'co_owner'),
    '%pending co-owner invite%');

  perform pg_temp.as_user(u_co);
  select * into v_member from public.accept_team_invite(v_token);
  perform pg_temp.check('co-owner accepted as owner',
    v_member.role = 'owner' and v_member.user_id = u_co);

  select count(*) into v_count from public.wedding_members
  where wedding_id = w and role = 'owner';
  perform pg_temp.check('two equal owners', v_count = 2);
  select count(*) into v_count from public.wedding_member_permissions
  where wedding_id = w and user_id = u_co;
  perform pg_temp.check('owners have no permission rows', v_count = 0);

  perform pg_temp.as_user(u_owner);
  perform pg_temp.expect_error('third owner invite blocked',
    format('select * from public.create_team_invite(%L, %L, %L)', w, 'm4-owner2@kiburan.test', 'co_owner'),
    '%already has two owners%');

  ---------------------------------------------------------------------------
  -- Concurrent-style double accept: second call after first succeeds
  ---------------------------------------------------------------------------

  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm4-owner2@kiburan.test', 'collaborator', 'viewer');
  perform pg_temp.as_user(u_owner2);
  perform public.accept_team_invite(v_token);
  perform pg_temp.expect_error('second accept fails',
    format('select public.accept_team_invite(%L)', v_token),
    '%already been used%');

  perform pg_temp.as_anon();
  perform pg_temp.expect_error('anon cannot accept',
    format('select public.accept_team_invite(%L)', v_token),
    'permission denied%');
  perform pg_temp.expect_error('anon cannot create',
    format('select * from public.create_team_invite(%L, %L)', w, 'z@kiburan.test'),
    'permission denied%');

  ---------------------------------------------------------------------------
  -- Invitee inbox: list_my_pending_team_invites + accept_my_team_invite
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select invite_id into v_invite_id
  from public.create_team_invite(w, 'm4-inbox@kiburan.test', 'collaborator', 'viewer');

  perform pg_temp.as_user(u_wrong);
  v_list := public.list_my_pending_team_invites();
  perform pg_temp.check('wrong email sees empty inbox', jsonb_array_length(v_list) = 0);
  perform pg_temp.expect_error('wrong email cannot accept by id',
    format('select public.accept_my_team_invite(%L)', v_invite_id),
    '%different email address%');

  perform pg_temp.as_user(u_inbox);
  v_list := public.list_my_pending_team_invites();
  perform pg_temp.check('invitee sees pending invite',
    jsonb_array_length(v_list) = 1
    and v_list -> 0 ->> 'id' = v_invite_id::text
    and v_list -> 0 ->> 'wedding_title' = 'M4 Wedding');

  select * into v_member from public.accept_my_team_invite(v_invite_id);
  perform pg_temp.check('inbox accept creates membership',
    v_member.user_id = u_inbox and v_member.role = 'viewer');

  v_list := public.list_my_pending_team_invites();
  perform pg_temp.check('inbox empty after accept', jsonb_array_length(v_list) = 0);

  ---------------------------------------------------------------------------
  -- validate_team_invite_email (passwordless gate)
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_team_invite(w, 'm4-otp@kiburan.test', 'collaborator', 'viewer');

  perform pg_temp.as_anon();
  v_preview := public.validate_team_invite_email(v_token, 'm4-otp@kiburan.test');
  perform pg_temp.check('validate email ok',
    (v_preview ->> 'ok')::boolean
    and v_preview ->> 'wedding_title' = 'M4 Wedding');
  perform pg_temp.expect_error('validate wrong email',
    format('select public.validate_team_invite_email(%L, %L)', v_token, 'm4-wrong@kiburan.test'),
    '%different email address%');

  raise notice 'PASS: planning_team_invites checks completed';
end;
$$;

rollback;
