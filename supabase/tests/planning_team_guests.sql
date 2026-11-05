-- Planning Team shared guest management (Milestone 6).
--
-- Usage:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/planning_team_guests.sql

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
  u_owner uuid := pg_temp.make_user('m6-owner@kiburan.test');
  u_coord uuid := pg_temp.make_user('m6-coord@kiburan.test');
  u_viewer uuid := pg_temp.make_user('m6-viewer@kiburan.test');
  w uuid;
  v_bride uuid;
  v_groom uuid;
  v_guest_bride uuid;
  v_guest_groom uuid;
  v_guest uuid;
  v_json jsonb;
  v_count integer;
  v_family jsonb;
begin
  perform pg_temp.as_user(u_owner);
  select id into w from public.create_wedding('M6 Wedding', 'Selam', 'Dawit');

  v_family := public.ensure_family_guest_groups(w);
  v_bride := (v_family ->> 'partner_one_group_id')::uuid;
  v_groom := (v_family ->> 'partner_two_group_id')::uuid;
  perform pg_temp.check('family groups created', v_bride is not null and v_groom is not null);
  perform pg_temp.check('family sides recorded',
    v_family -> 'created_sides' ? 'partner_one' and v_family -> 'created_sides' ? 'partner_two');

  -- Idempotent.
  v_family := public.ensure_family_guest_groups(w);
  perform pg_temp.check('family ensure is idempotent',
    jsonb_array_length(v_family -> 'created_sides') = 0);

  perform pg_temp.as_admin();
  insert into public.wedding_members (wedding_id, user_id, role)
  values (w, u_coord, 'family_coordinator'), (w, u_viewer, 'viewer');
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  select w, u_coord, t.permission from public.wedding_role_templates t where t.template = 'family_coordinator';
  -- Viewer: guests.view but NOT contacts.view
  insert into public.wedding_member_permissions (wedding_id, user_id, permission)
  values (w, u_viewer, 'team.view'), (w, u_viewer, 'guests.view'), (w, u_viewer, 'tasks.view');

  perform pg_temp.as_user(u_owner);
  perform public.assign_group_coordinator(w, v_bride, u_coord, false, true);

  insert into public.guests (wedding_id, group_id, full_name, phone, email, notes)
  values (w, v_bride, 'Bride Cousin', '+251911000001', 'bride.cousin@kiburan.test', 'spicy')
  returning id into v_guest_bride;
  insert into public.guests (wedding_id, group_id, full_name, phone, email)
  values (w, v_groom, 'Groom Uncle', '+251911000002', 'groom.uncle@kiburan.test')
  returning id into v_guest_groom;

  ---------------------------------------------------------------------------
  -- Coordinator isolation
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_coord);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('coordinator sees only own group guests', v_count = 1);

  select count(*) into v_count from public.guest_groups where wedding_id = w;
  perform pg_temp.check('coordinator sees only coordinated group', v_count = 1);

  v_json := public.get_guest_stats(w, null);
  perform pg_temp.check('coordinator stats are scoped', (v_json ->> 'total')::integer = 1);

  v_json := public.list_wedding_guests(w, null, null, 40, 0);
  perform pg_temp.check('coordinator list size', jsonb_array_length(v_json -> 'items') = 1);
  perform pg_temp.check('coordinator sees contacts for own group',
    v_json -> 'items' -> 0 ->> 'phone' = '+251911000001'
    and (v_json -> 'items' -> 0 ->> 'contacts_visible')::boolean);

  perform pg_temp.expect_error('coordinator cannot assign self to other group',
    format('select public.assign_group_coordinator(%L, %L, %L)', w, v_groom, u_coord),
    '%only wedding owners%');

  ---------------------------------------------------------------------------
  -- Contact privacy (D7): viewer with guests.view only
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_viewer);
  v_json := public.get_wedding_guest(w, v_guest_bride);
  perform pg_temp.check('viewer sees guest name', v_json ->> 'full_name' = 'Bride Cousin');
  perform pg_temp.check('viewer contacts nulled',
    v_json ->> 'phone' is null
    and v_json ->> 'email' is null
    and v_json ->> 'notes' is null
    and (v_json ->> 'contacts_visible')::boolean is false);

  perform pg_temp.expect_error('direct phone select revoked',
    format('select phone from public.guests where id = %L', v_guest_bride),
    '%permission denied%');

  ---------------------------------------------------------------------------
  -- Owner attribution + delete RPCs
  ---------------------------------------------------------------------------

  perform pg_temp.as_user(u_owner);
  v_json := public.get_wedding_guest(w, v_guest_bride);
  perform pg_temp.check('owner sees attribution name',
    v_json ->> 'created_by_name' = 'm6-owner');

  perform public.delete_guest(w, v_guest_groom);
  select count(*) into v_count from public.guests where id = v_guest_groom;
  perform pg_temp.check('delete_guest removed row', v_count = 0);

  perform pg_temp.as_user(u_coord);
  perform pg_temp.expect_error('coordinator cannot delete group',
    format('select public.delete_guest_group(%L, %L)', w, v_bride),
    '%permission denied%');

  perform pg_temp.as_user(u_owner);
  insert into public.guests (wedding_id, group_id, full_name)
  values (w, v_bride, 'Temp') returning id into v_guest;
  perform public.delete_guest(w, v_guest);

  -- Unassign coordinator
  perform public.unassign_group_coordinator(w, v_bride, u_coord);
  perform pg_temp.as_user(u_coord);
  select count(*) into v_count from public.guests where wedding_id = w;
  perform pg_temp.check('unassigned coordinator loses guest access', v_count = 0);

  raise notice 'PASS: planning_team_guests checks completed';
end;
$$;

rollback;
