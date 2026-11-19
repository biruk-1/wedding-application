-- Local SQL checks for vendor P1 + create/submit RPCs. Rolls back; nothing persists.
-- Note: authenticated INSERT ... RETURNING on vendors can fail the SELECT policy check
-- before the owner membership is readable in the same statement; the app uses create_vendor.
begin;

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

do $$
declare
  v_cat uuid;
  v_vendor public.vendors;
  v_uid uuid := '11111111-1111-4111-8111-111111111111';
  v_status text;
  v_listing text;
begin
  perform pg_temp.as_user(v_uid);
  if auth.uid() is distinct from v_uid then
    raise exception 'auth.uid() not set: %', auth.uid();
  end if;

  select id into v_cat from public.vendor_categories order by name_en limit 1;

  insert into public.vendors (
    owner_user_id, business_name, slug, verification_status, listing_status
  ) values (
    v_uid, 'M4 Direct Insert Probe', 'm4-test-direct-insert', 'verified', 'published'
  );

  select verification_status, listing_status into v_status, v_listing
  from public.vendors where slug = 'm4-test-direct-insert';

  if v_status <> 'unverified' or v_listing <> 'draft' then
    raise exception 'S1 guard failed: got % / %', v_status, v_listing;
  end if;
  delete from public.vendors where slug = 'm4-test-direct-insert';

  v_vendor := public.create_vendor(
    'M4 Create Vendor Probe',
    array[v_cat],
    'Addis Ababa',
    'A short description that is long enough to submit later for verification review.',
    '+251911000000',
    'm4.probe@kiburan.local'
  );

  if v_vendor.verification_status <> 'unverified' or v_vendor.listing_status <> 'draft' then
    raise exception 'create_vendor status failed';
  end if;
  if not exists (
    select 1 from public.vendor_team_members t
    where t.vendor_id = v_vendor.id and t.user_id = v_uid and t.role = 'owner'
  ) then
    raise exception 'owner team row missing';
  end if;

  v_vendor := public.submit_vendor_for_verification(v_vendor.id);
  if v_vendor.verification_status <> 'pending' then
    raise exception 'submit failed: %', v_vendor.verification_status;
  end if;

  delete from public.vendors where id = v_vendor.id;
end;
$$;

rollback;
select 'vendor_onboarding_p1 ok' as result;
