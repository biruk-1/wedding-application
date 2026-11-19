-- Smoke: P2 inquiry/booking reads + P3 quote/booking workflow (rolls back).
begin;

do $$
declare
  v_vendor_id uuid;
  v_owner uuid;
  v_couple uuid := gen_random_uuid();
  v_wedding uuid;
  v_service uuid;
  v_package uuid;
  v_inquiry uuid;
  v_quote_id uuid;
  v_list jsonb;
  v_detail jsonb;
  v_accept jsonb;
  v_booking_id uuid;
  v_booking jsonb;
begin
  select v.id, v.owner_user_id into v_vendor_id, v_owner
  from public.vendors v
  where v.slug = 'lumen-lace-studio';
  if v_vendor_id is null then
    raise exception 'seed vendor lumen-lace-studio missing — run seed first';
  end if;

  select s.id into v_service
  from public.vendor_services s
  where s.vendor_id = v_vendor_id
  limit 1;
  select p.id into v_package
  from public.vendor_packages p
  where p.service_id = v_service
  limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_couple, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm7.couple@kiburan.local', crypt('CoupleTestPass1', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Tsehay Bekele"}'::jsonb
  );

  insert into public.profiles (id, display_name, phone)
  values (v_couple, 'Tsehay Bekele', '+251911000111')
  on conflict (id) do update set display_name = excluded.display_name, phone = excluded.phone;

  insert into public.weddings (
    id, created_by, title, partner_one_name, partner_two_name, wedding_date, city, celebration_kind
  ) values (
    gen_random_uuid(), v_couple, 'Tsehay & Daniel', 'Tsehay Bekele', 'Daniel Mekonnen',
    '2026-12-20', 'Addis Ababa', 'wedding'
  )
  returning id into v_wedding;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_wedding, v_couple, 'owner');

  insert into public.vendor_inquiries (
    vendor_id, wedding_id, service_id, message, proposed_budget, status, created_by
  ) values (
    v_vendor_id, v_wedding, v_service, 'Looking for full-day coverage.', 50000, 'new', v_couple
  )
  returning id into v_inquiry;

  -- Vendor auth
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);

  v_list := public.vendor_list_inquiries(v_vendor_id, 'new', 10, null, null);
  if jsonb_array_length(v_list->'items') < 1 then
    raise exception 'expected inquiry in list';
  end if;
  if (v_list->'items'->0->'couple'->>'couple_label') is distinct from 'Tsehay & Daniel' then
    raise exception 'expected couple label, got %', v_list->'items'->0->'couple'->>'couple_label';
  end if;
  if (v_list->'items'->0->'couple'->>'contact_phone') is not null then
    raise exception 'contact must stay hidden before confirmed booking';
  end if;

  v_detail := public.vendor_send_quote(v_inquiry, 48000, v_package, 'Full day package', '2026-11-30', 'ETB');
  if (v_detail->>'status') is distinct from 'quoted' then
    raise exception 'inquiry should be quoted';
  end if;
  v_quote_id := (v_detail->'quotes'->0->>'id')::uuid;

  -- Couple accepts
  perform set_config('request.jwt.claim.sub', v_couple::text, true);
  v_accept := public.accept_vendor_quote(v_quote_id);
  v_booking_id := (v_accept->>'booking_id')::uuid;
  if v_booking_id is null then raise exception 'accept_vendor_quote missing booking'; end if;

  -- Vendor confirms
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_booking := public.vendor_respond_booking(v_booking_id, 'confirm', 'Looking forward to it');
  if (v_booking->>'status') is distinct from 'confirmed' then
    raise exception 'booking should be confirmed';
  end if;
  if (v_booking->'couple'->>'contact_phone') is distinct from '+251911000111' then
    raise exception 'contact phone should appear after confirmation';
  end if;
end $$;

select 'vendor_p2_p3_workflows ok' as result;

rollback;
