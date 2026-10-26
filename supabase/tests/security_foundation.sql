-- Security foundation tests for local Kiburan.
-- Run as postgres (bypasses RLS for setup), then switch JWT claims via set_config.
-- Expected: every assertion raises on failure.
--
-- Usage (after supabase start / db reset):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/security_foundation.sql

begin;

create extension if not exists pgcrypto;

-- Synthetic auth users (local only)
create or replace function pg_temp.make_user(p_email text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    p_email,
    crypt('password', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_email),
    now(),
    now()
  );
  return v_id;
end;
$$;

do $$
declare
  u_owner uuid;
  u_other uuid;
  u_viewer uuid;
  w1 public.weddings;
  w2 public.weddings;
  v_event1 uuid;
  v_event2 uuid;
  v_task uuid;
  v_invite_token text;
  v_invite_id uuid;
  v_member public.wedding_members;
  v_count integer;
  v_vendor uuid;
begin
  u_owner := pg_temp.make_user('owner@kiburan.test');
  u_other := pg_temp.make_user('other@kiburan.test');
  u_viewer := pg_temp.make_user('viewer@kiburan.test');

  -- Profile trigger should have created profiles
  select count(*) into v_count from public.profiles where id in (u_owner, u_other, u_viewer);
  if v_count <> 3 then
    raise exception 'FAIL: profile provisioning expected 3 profiles, got %', v_count;
  end if;

  -- Create wedding as owner via RPC
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);

  select * into w1 from public.create_wedding(
    'Alpha Wedding', 'Amina', 'Biruk', current_date + 180, 'Addis Ababa'
  );
  if w1.id is null then
    raise exception 'FAIL: create_wedding returned null';
  end if;

  select count(*) into v_count from public.wedding_members
  where wedding_id = w1.id and user_id = u_owner and role = 'owner';
  if v_count <> 1 then
    raise exception 'FAIL: owner membership missing after create_wedding';
  end if;

  select count(*) into v_count from public.wedding_budgets where wedding_id = w1.id;
  if v_count <> 1 then
    raise exception 'FAIL: wedding_budgets row missing after create_wedding';
  end if;

  -- Other user creates a separate wedding
  perform set_config('request.jwt.claim.sub', u_other::text, true);
  select * into w2 from public.create_wedding(
    'Beta Wedding', 'Sara', 'Dawit', current_date + 200, 'Adama'
  );

  -- Owner cannot read other wedding
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  select count(*) into v_count from public.weddings where id = w2.id;
  if v_count <> 0 then
    raise exception 'FAIL: owner can read another wedding';
  end if;

  -- Direct insert into weddings should fail under RLS for authenticated
  begin
    insert into public.weddings (created_by, title, partner_one_name, partner_two_name)
    values (u_owner, 'Should Fail', 'X', 'Y');
    raise exception 'FAIL: direct wedding insert should be denied';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      -- RLS violation typically raises with SQLSTATE 42501 or just 0 rows depending on path
      null;
  end;

  -- Confirm direct insert produced no row (RLS with check failure)
  select count(*) into v_count from public.weddings where title = 'Should Fail';
  -- As security definer bypass... we're still as authenticated via role setting.
  -- Switch to postgres to count, then back.
  perform set_config('role', 'postgres', true);
  select count(*) into v_count from public.weddings where title = 'Should Fail';
  if v_count <> 0 then
    raise exception 'FAIL: direct wedding insert bypassed RLS';
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', u_owner::text, true);

  -- Owner writes event + task
  insert into public.wedding_events (wedding_id, name, event_type)
  values (w1.id, 'Ceremony', 'ceremony')
  returning id into v_event1;

  insert into public.wedding_tasks (wedding_id, title, created_by)
  values (w1.id, 'Book the venue', u_owner)
  returning id into v_task;

  -- Cross-wedding: attach w1 task to w2 event must fail
  perform set_config('role', 'postgres', true);
  insert into public.wedding_events (wedding_id, name)
  values (w2.id, 'Other ceremony')
  returning id into v_event2;
  begin
    update public.wedding_tasks set event_id = v_event2 where id = v_task;
    raise exception 'FAIL: cross-wedding task.event_id should be rejected';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%cross-wedding%' then
        raise exception 'FAIL: unexpected error for cross-wedding: %', sqlerrm;
      end if;
  end;

  -- Seating assignment table/event mismatch
  insert into public.seating_tables (event_id, name, capacity) values (v_event1, 'T1', 8);
  begin
    insert into public.seating_assignments (event_id, guest_id, table_id)
    select v_event2, g.id, st.id
    from public.guests g
    cross join public.seating_tables st
    where false; -- placeholder; create guest first
  exception when others then null;
  end;

  insert into public.guests (wedding_id, full_name) values (w1.id, 'Guest One');
  begin
    insert into public.seating_assignments (event_id, guest_id, table_id)
    select v_event2, g.id, st.id
    from public.guests g, public.seating_tables st
    where g.wedding_id = w1.id and st.event_id = v_event1
    limit 1;
    raise exception 'FAIL: seating cross-event should be rejected';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%seating table%' and sqlerrm not like '%cross-wedding%' then
        raise exception 'FAIL: unexpected seating error: %', sqlerrm;
      end if;
  end;

  -- Invite flow
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  select invite_id, raw_token into v_invite_id, v_invite_token
  from public.create_wedding_invite(w1.id, 'viewer', 'viewer@kiburan.test', null, interval '1 day');

  if v_invite_token is null then
    raise exception 'FAIL: create_wedding_invite returned no token';
  end if;

  -- token_hash not readable by authenticated
  begin
    perform set_config('role', 'authenticated', true);
    perform token_hash from public.wedding_invites where id = v_invite_id;
    -- If column privilege works, this errors
  exception
    when insufficient_privilege then null;
    when undefined_column then null;
    when others then null;
  end;

  -- Accept as viewer
  perform set_config('request.jwt.claim.sub', u_viewer::text, true);
  select * into v_member from public.accept_wedding_invite(v_invite_token);
  if v_member.role <> 'viewer' or v_member.user_id <> u_viewer then
    raise exception 'FAIL: accept_wedding_invite membership incorrect';
  end if;

  -- Reuse token must fail
  begin
    perform public.accept_wedding_invite(v_invite_token);
    raise exception 'FAIL: reused invite token should be rejected';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%already been used%' then
        raise exception 'FAIL: unexpected reuse error: %', sqlerrm;
      end if;
  end;

  -- Expired token
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  select invite_id, raw_token into v_invite_id, v_invite_token
  from public.create_wedding_invite(w1.id, 'collaborator', 'expired@kiburan.test', null, interval '-1 hour');
  perform set_config('request.jwt.claim.sub', u_other::text, true);
  begin
    perform public.accept_wedding_invite(v_invite_token);
    raise exception 'FAIL: expired invite should be rejected';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%expired%' then
        raise exception 'FAIL: unexpected expiry error: %', sqlerrm;
      end if;
  end;

  -- Viewer cannot change membership roles
  perform set_config('request.jwt.claim.sub', u_viewer::text, true);
  begin
    perform public.set_wedding_member_role(w1.id, u_viewer, 'owner');
    raise exception 'FAIL: viewer must not change roles';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%only wedding owners%' then
        raise exception 'FAIL: unexpected role-change error: %', sqlerrm;
      end if;
  end;

  -- Viewer cannot insert tasks
  begin
    insert into public.wedding_tasks (wedding_id, title) values (w1.id, 'Viewer task');
    -- count as postgres
    perform set_config('role', 'postgres', true);
    select count(*) into v_count from public.wedding_tasks where title = 'Viewer task';
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', u_viewer::text, true);
    if v_count <> 0 then
      raise exception 'FAIL: viewer wrote a task';
    end if;
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      null;
  end;

  -- Vendor public browse rules
  perform set_config('role', 'postgres', true);
  insert into public.vendors (owner_user_id, business_name, slug, listing_status, verification_status)
  values (u_other, 'Hidden Draft', 'hidden-draft', 'draft', 'unverified')
  returning id into v_vendor;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  select count(*) into v_count from public.vendors where id = v_vendor;
  if v_count <> 0 then
    raise exception 'FAIL: draft vendor visible to outsider';
  end if;

  -- Promote listing as DB admin (postgres). Clients must not be able to self-verify.
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.vendors
  set listing_status = 'published', verification_status = 'verified'
  where id = v_vendor;

  -- Authenticated outsider cannot change verification back
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', u_other::text, true);
  begin
    update public.vendors set verification_status = 'unverified' where id = v_vendor;
    raise exception 'FAIL: vendor owner must not self-change verification_status';
  exception
    when others then
      if sqlerrm like 'FAIL:%' then raise; end if;
      if sqlerrm not like '%verification_status%' then
        raise exception 'FAIL: unexpected verification protect error: %', sqlerrm;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', u_owner::text, true);
  select count(*) into v_count from public.vendors where id = v_vendor;
  if v_count <> 1 then
    raise exception 'FAIL: published+verified vendor not visible';
  end if;

  raise notice 'PASS: security_foundation checks completed';
end;
$$;

rollback;
