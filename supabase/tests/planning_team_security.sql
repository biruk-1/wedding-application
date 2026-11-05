-- Planning Team database foundation tests (Milestone 2).
-- Runs inside one transaction and rolls back; nothing persists.
--
-- Usage (after the team_* migrations are applied locally):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_security.sql

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
    jsonb_build_object('display_name', p_email), now(), now()
  );
  return v_id;
end;
$$;

-- Signed-in API caller: RLS and grants apply.
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

-- Database administrator with no user context (migrations, support tooling).
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

-- Bypasses RLS but keeps a user identity, to prove triggers enforce rules on their own.
create or replace function pg_temp.as_privileged_user(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
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
  u_owner_a uuid := pg_temp.make_user('pt-owner-a@kiburan.test');
  u_owner_b uuid := pg_temp.make_user('pt-owner-b@kiburan.test');
  u_collab uuid := pg_temp.make_user('pt-collab@kiburan.test');
  u_viewer uuid := pg_temp.make_user('pt-viewer@kiburan.test');
  u_coord uuid := pg_temp.make_user('pt-coord@kiburan.test');
  u_outsider uuid := pg_temp.make_user('pt-outsider@kiburan.test');
  u_other_owner uuid := pg_temp.make_user('pt-other-owner@kiburan.test');
  w uuid;
  w_other uuid;
  v_invite_id uuid;
  v_token text;
  v_member public.wedding_members;
  v_text text;
  v_count integer;
  v_event uuid;
  v_guest_invite uuid;
  v_group_bride uuid;
  v_group_groom uuid;
  v_group_other uuid;
  v_guest uuid;
  v_guest_row public.guests;
  v_access jsonb;
begin
  -- Setup: two weddings created through the normal RPC.
  perform pg_temp.as_user(u_owner_a);
  select id into w from public.create_wedding('PT Wedding', 'Selam', 'Dawit');
  perform pg_temp.as_user(u_other_owner);
  select id into w_other from public.create_wedding('PT Other Wedding', 'Hana', 'Yonas');

  ---------------------------------------------------------------------------
  -- Hardening: invite tokens, binding, duplicates, expiry
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner_a);
  select invite_id, raw_token into v_invite_id, v_token
  from public.create_wedding_invite(w, 'collaborator', '  PT-Collab@Kiburan.TEST ', null, interval '2 days');

  select invited_email into v_text from public.wedding_invites where id = v_invite_id;
  perform pg_temp.check('invite email is normalized', v_text = 'pt-collab@kiburan.test');

  perform pg_temp.expect_error('wedding_invites.token_hash unreadable',
    'select token_hash from public.wedding_invites', 'permission denied%');
  perform pg_temp.expect_error('wedding_invites direct insert denied',
    format('insert into public.wedding_invites (wedding_id, invited_email, role, token_hash, expires_at)
            values (%L, %L, %L, %L, now() + interval ''1 day'')', w, 'x@kiburan.test', 'viewer', 'abc'),
    'permission denied%');
  perform pg_temp.expect_error('wedding_invites token_hash update denied',
    format('update public.wedding_invites set token_hash = %L where id = %L', 'abc', v_invite_id),
    'permission denied%');

  perform pg_temp.expect_error('duplicate pending invite rejected',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'viewer', 'pt-collab@kiburan.test'),
    '%pending invite already exists%');
  perform pg_temp.expect_error('negative expiry rejected',
    format('select * from public.create_wedding_invite(%L, %L, %L, null, interval ''-1 hour'')', w, 'viewer', 'n1@kiburan.test'),
    '%between 1 hour and 30 days%');
  perform pg_temp.expect_error('long expiry rejected',
    format('select * from public.create_wedding_invite(%L, %L, %L, null, interval ''90 days'')', w, 'viewer', 'n2@kiburan.test'),
    '%between 1 hour and 30 days%');
  perform pg_temp.expect_error('phone-only invite rejected',
    format('select * from public.create_wedding_invite(%L, %L, null, %L)', w, 'viewer', '+251911000000'),
    '%invited_email is required%');
  perform pg_temp.expect_error('invalid email rejected',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'viewer', 'not-an-email'),
    '%not a valid email%');
  perform pg_temp.expect_error('invite for existing member rejected',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'viewer', 'PT-OWNER-A@kiburan.test'),
    '%already a member%');
  perform pg_temp.expect_error('owner role cannot be invited',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'owner', 'n3@kiburan.test'),
    '%invalid invite role%');

  perform pg_temp.as_user(u_outsider);
  perform pg_temp.expect_error('non-member cannot invite',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'viewer', 'n4@kiburan.test'),
    '%only wedding owners%');

  perform pg_temp.as_user(u_viewer);
  perform pg_temp.expect_error('invite bound to its email',
    format('select public.accept_wedding_invite(%L)', v_token),
    '%different email address%');

  perform pg_temp.as_admin();
  select count(*) into v_count from public.wedding_invites where id = v_invite_id and accepted_at is null;
  perform pg_temp.check('wrong-account attempt does not consume invite', v_count = 1);

  perform pg_temp.as_user(u_collab);
  select * into v_member from public.accept_wedding_invite(v_token);
  perform pg_temp.check('invited account accepts', v_member.user_id = u_collab and v_member.role = 'collaborator');

  -- An invite that reaches an existing owner must not change their role.
  perform pg_temp.as_admin();
  insert into public.wedding_invites (wedding_id, invited_email, role, token_hash, invited_by, expires_at)
  values (w, 'pt-owner-a@kiburan.test', 'viewer',
    encode(extensions.digest('pt-owner-token', 'sha256'), 'hex'), u_owner_a, now() + interval '1 day');
  perform pg_temp.as_user(u_owner_a);
  perform pg_temp.expect_error('accepting cannot downgrade an owner',
    'select public.accept_wedding_invite(''pt-owner-token'')', '%already a member%');
  perform pg_temp.as_admin();
  select role into v_text from public.wedding_members where wedding_id = w and user_id = u_owner_a;
  perform pg_temp.check('owner role unchanged after invite attempt', v_text = 'owner');

  -- Unconfirmed email cannot accept.
  perform pg_temp.as_user(u_owner_a);
  select raw_token into v_token
  from public.create_wedding_invite(w, 'viewer', 'pt-viewer@kiburan.test', null, interval '1 day');
  perform pg_temp.as_admin();
  update auth.users set email_confirmed_at = null where id = u_viewer;
  perform pg_temp.as_user(u_viewer);
  perform pg_temp.expect_error('unconfirmed email cannot accept',
    format('select public.accept_wedding_invite(%L)', v_token), '%confirm your email%');
  perform pg_temp.as_admin();
  update auth.users set email_confirmed_at = now() where id = u_viewer;
  perform pg_temp.as_user(u_viewer);
  select * into v_member from public.accept_wedding_invite(v_token);
  perform pg_temp.check('viewer joins after confirming', v_member.role = 'viewer');

  ---------------------------------------------------------------------------
  -- Hardening: anonymous RPC access, guest invitation tokens, wedding fields, timeline
  ---------------------------------------------------------------------------

  perform pg_temp.as_anon();
  perform pg_temp.expect_error('anon cannot create weddings',
    'select public.create_wedding(''x'', ''a'', ''b'')', 'permission denied%');
  perform pg_temp.expect_error('anon cannot accept team invites',
    'select public.accept_wedding_invite(''x'')', 'permission denied%');
  perform pg_temp.expect_error('anon cannot change roles',
    format('select public.set_wedding_member_role(%L, %L, %L)', w, u_collab, 'viewer'), 'permission denied%');
  perform pg_temp.expect_error('anon cannot read access summary',
    format('select public.get_my_wedding_access(%L)', w), 'permission denied%');
  perform pg_temp.expect_error('anon guest RSVP lookup still callable',
    'select public.get_guest_invitation_by_token(''not-a-token'')', '%invitation%');

  perform pg_temp.as_user(u_owner_a);
  insert into public.guests (wedding_id, full_name) values (w, 'Invite Guest') returning id into v_guest;
  select invitation_id into v_guest_invite from public.create_guest_invitation(w, v_guest);
  perform pg_temp.expect_error('invitations.token_hash unreadable',
    'select token_hash from public.invitations', 'permission denied%');
  perform pg_temp.expect_error('invitations direct insert denied',
    format('insert into public.invitations (wedding_id, guest_id, token_hash) values (%L, %L, %L)', w, v_guest, 'abc'),
    'permission denied%');
  select count(*) into v_count from public.invitations where id = v_guest_invite;
  perform pg_temp.check('owner reads invitation without hash', v_count = 1);
  update public.invitations set status = 'cancelled' where id = v_guest_invite;
  select count(*) into v_count from public.invitations where id = v_guest_invite and status = 'cancelled';
  perform pg_temp.check('owner can still cancel guest invitation', v_count = 1);

  -- Direct wedding updates are denied (settings go through update_wedding_settings).
  update public.weddings set created_by = u_collab where id = w;
  perform pg_temp.as_admin();
  select count(*) into v_count from public.weddings where id = w and created_by = u_owner_a;
  perform pg_temp.check('wedding creator cannot be reassigned', v_count = 1);
  perform pg_temp.as_user(u_owner_a);

  insert into public.wedding_events (wedding_id, name) values (w, 'Ceremony') returning id into v_event;
  perform pg_temp.expect_error('timeline assignee must be a member',
    format('insert into public.timeline_items (event_id, title, starts_at, assigned_to) values (%L, %L, now(), %L)',
      v_event, 'Walk in', u_outsider),
    '%must be a member%');
  insert into public.timeline_items (event_id, title, starts_at, assigned_to)
  values (v_event, 'Walk in', now(), u_collab);

  ---------------------------------------------------------------------------
  -- Ownership: role RPC cannot touch owners, plain writes cannot create owners,
  -- one to two owners per wedding.
  ---------------------------------------------------------------------------

  perform pg_temp.expect_error('role RPC cannot promote to owner',
    format('select public.set_wedding_member_role(%L, %L, %L)', w, u_collab, 'owner'), '%ownership workflow%');
  perform pg_temp.expect_error('role RPC cannot demote an owner',
    format('select public.set_wedding_member_role(%L, %L, %L)', w, u_owner_a, 'viewer'), '%ownership workflow%');
  select * into v_member from public.set_wedding_member_role(w, u_collab, 'planner');
  perform pg_temp.check('role RPC changes non-owner roles', v_member.role = 'planner');
  select * into v_member from public.set_wedding_member_role(w, u_collab, 'collaborator');

  perform pg_temp.as_user(u_collab);
  perform pg_temp.expect_error('collaborator cannot change roles',
    format('select public.set_wedding_member_role(%L, %L, %L)', w, u_viewer, 'planner'), '%only wedding owners%');
  perform pg_temp.expect_error('collaborator cannot invite',
    format('select * from public.create_wedding_invite(%L, %L, %L)', w, 'viewer', 'n5@kiburan.test'),
    '%only wedding owners%');

  perform pg_temp.as_privileged_user(u_owner_a);
  perform pg_temp.expect_error('owner cannot be created by a plain update',
    format('update public.wedding_members set role = %L where wedding_id = %L and user_id = %L', 'owner', w, u_collab),
    '%ownership workflow%');
  perform pg_temp.expect_error('owner cannot be removed by a plain delete',
    format('delete from public.wedding_members where wedding_id = %L and user_id = %L', w, u_owner_a),
    '%ownership workflow%');
  perform pg_temp.expect_error('owner cannot be inserted directly',
    format('insert into public.wedding_members (wedding_id, user_id, role) values (%L, %L, %L)', w, u_owner_b, 'owner'),
    '%ownership workflow%');
  perform pg_temp.expect_error('membership keys are immutable',
    format('update public.wedding_members set user_id = %L where wedding_id = %L and user_id = %L', u_outsider, w, u_collab),
    '%cannot change%');

  -- The ownership workflow flag allows changes but the 1-2 owner limit still holds.
  perform set_config('kiburan.allow_owner_change', 'on', true);
  insert into public.wedding_members (wedding_id, user_id, role) values (w, u_owner_b, 'owner');
  perform pg_temp.expect_error('at most two owners',
    format('update public.wedding_members set role = %L where wedding_id = %L and user_id = %L', 'owner', w, u_collab),
    '%at most two owners%');
  delete from public.wedding_members where wedding_id = w and user_id = u_owner_b;
  perform pg_temp.expect_error('at least one owner',
    format('delete from public.wedding_members where wedding_id = %L and user_id = %L', w, u_owner_a),
    '%at least one owner%');
  insert into public.wedding_members (wedding_id, user_id, role) values (w, u_owner_b, 'owner');
  perform set_config('kiburan.allow_owner_change', '', true);

  select count(*) into v_count from public.wedding_members where wedding_id = w and role = 'owner';
  perform pg_temp.check('wedding has two equal owners', v_count = 2);

  perform pg_temp.as_user(u_owner_b);
  select * into v_member from public.set_wedding_member_role(w, u_viewer, 'viewer');
  perform pg_temp.check('second owner can manage roles', v_member.role = 'viewer');
  perform pg_temp.expect_error('second owner cannot demote first owner',
    format('select public.set_wedding_member_role(%L, %L, %L)', w, u_owner_a, 'viewer'), '%ownership workflow%');

  perform pg_temp.as_admin();
  perform pg_temp.expect_error('unknown role rejected',
    format('insert into public.wedding_members (wedding_id, user_id, role) values (%L, %L, %L)', w, u_outsider, 'superuser'),
    '%wedding_members_role_check%');
  insert into public.wedding_members (wedding_id, user_id, role) values (w, u_coord, 'family_coordinator');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_coord, t.permission from public.wedding_role_templates t where t.template = 'family_coordinator';

  ---------------------------------------------------------------------------
  -- Member permissions
  -- Accepting a collaborator invite now applies the legacy template (all grantable
  -- keys). Reset to a single permission so these assertions stay focused.
  ---------------------------------------------------------------------------

  delete from public.wedding_member_permissions
  where wedding_id = w and user_id = u_collab;
  insert into public.wedding_member_permissions (wedding_id, user_id, permission, granted_by)
  values (w, u_collab, 'tasks.view', u_owner_a);
  perform pg_temp.expect_error('owners hold no permission rows',
    format('insert into public.wedding_member_permissions (wedding_id, user_id, permission) values (%L, %L, %L)',
      w, u_owner_a, 'tasks.view'),
    '%owners already hold every permission%');
  perform pg_temp.expect_error('reserved permission not grantable',
    format('insert into public.wedding_member_permissions (wedding_id, user_id, permission) values (%L, %L, %L)',
      w, u_collab, 'team.invite'),
    '%not grantable%');
  perform pg_temp.expect_error('unknown permission rejected',
    format('insert into public.wedding_member_permissions (wedding_id, user_id, permission) values (%L, %L, %L)',
      w, u_collab, 'nope.nope'),
    '%not grantable%');
  perform pg_temp.expect_error('permission requires membership',
    format('insert into public.wedding_member_permissions (wedding_id, user_id, permission) values (%L, %L, %L)',
      w_other, u_collab, 'tasks.view'),
    '%foreign key%');

  perform pg_temp.as_user(u_collab);
  perform pg_temp.expect_error('members cannot grant themselves permissions',
    format('insert into public.wedding_member_permissions (wedding_id, user_id, permission) values (%L, %L, %L)',
      w, u_collab, 'budget.view'),
    'permission denied%');
  select count(*) into v_count from public.wedding_member_permissions where wedding_id = w;
  perform pg_temp.check('member sees own permission rows', v_count = 1);
  perform pg_temp.check('member has granted permission', private.has_wedding_permission(w, 'tasks.view'));
  perform pg_temp.check('member lacks budget by default', not private.has_wedding_permission(w, 'budget.view'));

  perform pg_temp.as_user(u_viewer);
  select count(*) into v_count from public.wedding_member_permissions
  where wedding_id = w and user_id = u_collab;
  perform pg_temp.check('member cannot see others permission rows', v_count = 0);

  perform pg_temp.as_user(u_owner_b);
  select count(*) into v_count from public.wedding_member_permissions
  where wedding_id = w and user_id = u_collab;
  perform pg_temp.check('owner sees all permission rows', v_count = 1);
  perform pg_temp.check('owner holds reserved permissions', private.has_wedding_permission(w, 'team.invite'));
  perform pg_temp.check('owner holds budget permissions', private.has_wedding_permission(w, 'budget.manage'));
  perform pg_temp.check('unknown key is never granted', not private.has_wedding_permission(w, 'nope.nope'));

  perform pg_temp.as_user(u_other_owner);
  perform pg_temp.check('other wedding owner has no permissions here', not private.has_wedding_permission(w, 'tasks.view'));

  ---------------------------------------------------------------------------
  -- Guest group coordinators
  ---------------------------------------------------------------------------

  perform pg_temp.as_admin();
  insert into public.guest_groups (wedding_id, name, side) values (w, 'Bride''s family', 'partner_one')
    returning id into v_group_bride;
  insert into public.guest_groups (wedding_id, name, side) values (w, 'Groom''s family', 'partner_two')
    returning id into v_group_groom;
  insert into public.guest_groups (wedding_id, name) values (w_other, 'Other wedding group')
    returning id into v_group_other;

  insert into public.guest_group_coordinators (wedding_id, group_id, user_id, assigned_by)
  values (w, v_group_bride, u_coord, u_owner_a);
  perform pg_temp.expect_error('coordinator group must belong to the wedding',
    format('insert into public.guest_group_coordinators (wedding_id, group_id, user_id) values (%L, %L, %L)',
      w, v_group_other, u_coord),
    '%foreign key%');
  perform pg_temp.expect_error('coordinator must be a member of the wedding',
    format('insert into public.guest_group_coordinators (wedding_id, group_id, user_id) values (%L, %L, %L)',
      w_other, v_group_other, u_coord),
    '%foreign key%');
  perform pg_temp.expect_error('coordinated group cannot move weddings',
    format('update public.guest_groups set wedding_id = %L where id = %L', w_other, v_group_bride),
    '%foreign key%');

  perform pg_temp.as_user(u_coord);
  perform pg_temp.check('coordinator views own group', private.can_access_guest_group(w, v_group_bride, 'view'));
  perform pg_temp.check('coordinator edits own group', private.can_access_guest_group(w, v_group_bride, 'update'));
  perform pg_temp.check('coordinator sends invitations by default',
    private.can_access_guest_group(w, v_group_bride, 'send_invitations'));
  perform pg_temp.check('coordinator cannot delete by default', not private.can_access_guest_group(w, v_group_bride, 'delete'));
  perform pg_temp.check('coordinator cannot see other groups', not private.can_access_guest_group(w, v_group_groom, 'view'));
  perform pg_temp.check('coordinator cannot see ungrouped guests', not private.can_access_guest_group(w, null, 'view'));
  perform pg_temp.check('unknown capability denied', not private.can_access_guest_group(w, v_group_bride, 'admin'));
  select count(*) into v_count from public.guest_group_coordinators where wedding_id = w;
  perform pg_temp.check('coordinator sees own assignment', v_count = 1);
  perform pg_temp.expect_error('coordinator cannot assign themselves',
    format('insert into public.guest_group_coordinators (wedding_id, group_id, user_id) values (%L, %L, %L)',
      w, v_group_groom, u_coord),
    'permission denied%');

  perform pg_temp.as_user(u_viewer);
  select count(*) into v_count from public.guest_group_coordinators where wedding_id = w;
  perform pg_temp.check('other members cannot see coordinator assignments', v_count = 0);

  perform pg_temp.as_user(u_owner_a);
  perform pg_temp.check('owner can delete in any group', private.can_access_guest_group(w, v_group_groom, 'delete'));

  ---------------------------------------------------------------------------
  -- Access summary RPC
  ---------------------------------------------------------------------------

  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('owner access summary', (v_access ->> 'is_owner')::boolean
    and v_access -> 'permissions' ? 'team.invite'
    and v_access -> 'permissions' ? 'budget.manage');

  perform pg_temp.as_user(u_collab);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('collaborator access summary', not (v_access ->> 'is_owner')::boolean
    and v_access -> 'permissions' = '["tasks.view"]'::jsonb
    and v_access ->> 'role' = 'collaborator');

  perform pg_temp.as_user(u_coord);
  v_access := public.get_my_wedding_access(w);
  perform pg_temp.check('coordinator access summary',
    jsonb_array_length(v_access -> 'coordinated_groups') = 1
    and v_access -> 'coordinated_groups' -> 0 ->> 'group_id' = v_group_bride::text);

  perform pg_temp.as_user(u_outsider);
  perform pg_temp.expect_error('non-member has no access summary',
    format('select public.get_my_wedding_access(%L)', w), '%not a member%');

  ---------------------------------------------------------------------------
  -- Attribution and activity history
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner_a);
  insert into public.guests (wedding_id, group_id, full_name, created_by, updated_by)
  values (w, v_group_bride, 'Almaz Tesfaye', u_other_owner, u_other_owner)
  returning id, created_by, updated_by, updated_at
  into v_guest_row.id, v_guest_row.created_by, v_guest_row.updated_by, v_guest_row.updated_at;
  perform pg_temp.check('guest creator is the caller',
    v_guest_row.created_by = u_owner_a and v_guest_row.updated_by = u_owner_a);

  -- Guest writes now require guests.update (permission RLS). Grant, edit, then revoke
  -- so the activity.view assertions below stay focused.
  perform pg_temp.as_admin();
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values (w, u_collab, 'guests.view'), (w, u_collab, 'guests.update');
  perform pg_temp.as_user(u_collab);
  update public.guests
  set full_name = 'Almaz T.', created_by = u_collab
  where id = v_guest_row.id
  returning created_by, updated_by, updated_at
  into v_guest_row.created_by, v_guest_row.updated_by, v_guest_row.updated_at;
  perform pg_temp.check('guest editor recorded, creator immutable',
    v_guest_row.created_by = u_owner_a and v_guest_row.updated_by = u_collab and v_guest_row.updated_at is not null);
  perform pg_temp.as_admin();
  delete from public.wedding_member_permissions
  where wedding_id = w and user_id = u_collab
    and permission in ('guests.view', 'guests.update');

  perform pg_temp.as_user(u_owner_b);
  select count(*) into v_count from public.wedding_activity_log
  where wedding_id = w and entity_id = v_guest_row.id;
  perform pg_temp.check('owner sees guest history', v_count = 2);
  select count(*) into v_count from public.wedding_activity_log
  where wedding_id = w and entity_id = v_guest_row.id and action = 'guest.updated'
    and actor_id = u_collab and summary -> 'changed' = '["full_name"]'::jsonb;
  perform pg_temp.check('update records actor and changed fields only', v_count = 1);
  select count(*) into v_count from public.wedding_activity_log
  where wedding_id = w and entity_type = 'guest_group' and action = 'guest_group.created';
  perform pg_temp.check('group creation logged', v_count = 2);
  perform pg_temp.expect_error('activity log not writable by clients',
    format('insert into public.wedding_activity_log (wedding_id, action, entity_type) values (%L, %L, %L)',
      w, 'guest.created', 'guest'),
    'permission denied%');
  perform pg_temp.expect_error('activity log cannot be deleted by owners',
    format('delete from public.wedding_activity_log where wedding_id = %L', w), 'permission denied%');
  perform pg_temp.expect_error('log_activity not callable by clients',
    format('select private.log_activity(%L, %L, %L, null, null)', w, 'guest.created', 'guest'),
    'permission denied%');

  perform pg_temp.as_user(u_collab);
  select count(*) into v_count from public.wedding_activity_log where wedding_id = w;
  perform pg_temp.check('no activity without activity.view', v_count = 0);

  perform pg_temp.as_admin();
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values (w, u_collab, 'activity.view');
  perform pg_temp.as_user(u_collab);
  select count(*) into v_count from public.wedding_activity_log where wedding_id = w;
  perform pg_temp.check('activity.view alone hides guest entries', v_count = 0);

  perform pg_temp.as_admin();
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values (w, u_collab, 'guests.view');
  perform pg_temp.as_user(u_collab);
  select count(*) into v_count from public.wedding_activity_log where wedding_id = w;
  perform pg_temp.check('activity.view plus guests.view shows guest entries', v_count > 0);

  perform pg_temp.as_user(u_other_owner);
  select count(*) into v_count from public.wedding_activity_log where wedding_id = w;
  perform pg_temp.check('other wedding owner sees no activity', v_count = 0);

  ---------------------------------------------------------------------------
  -- Promotion cleanup and wedding deletion
  ---------------------------------------------------------------------------

  perform pg_temp.as_admin();
  delete from public.wedding_members where wedding_id = w and user_id = u_owner_b;
  update public.wedding_members set role = 'owner' where wedding_id = w and user_id = u_collab;
  select count(*) into v_count from public.wedding_member_permissions where wedding_id = w and user_id = u_collab;
  perform pg_temp.check('promoted owner keeps no permission rows', v_count = 0);

  insert into public.guests (wedding_id, full_name) values (w_other, 'Cascade Guest');
  delete from public.weddings where id = w_other;
  select count(*) into v_count from public.wedding_activity_log where wedding_id = w_other;
  perform pg_temp.check('deleting a wedding removes its members and history', v_count = 0);
  select count(*) into v_count from public.wedding_members where wedding_id = w_other;
  perform pg_temp.check('wedding delete cascades memberships', v_count = 0);

  raise notice 'PASS: planning_team_security checks completed';
end;
$$;

rollback;
