-- Smoke: vendor_list_reviews + vendor_earnings_summary (rolls back).
begin;

do $$
declare
  v_vendor_id uuid;
  v_owner uuid;
  v_couple uuid := gen_random_uuid();
  v_wedding uuid;
  v_wv uuid;
  v_reviews jsonb;
  v_earnings jsonb;
begin
  select v.id, v.owner_user_id into v_vendor_id, v_owner
  from public.vendors v
  where v.slug = 'lumen-lace-studio';
  if v_vendor_id is null then
    raise exception 'seed vendor lumen-lace-studio missing — run seed first';
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    v_couple, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'm8.couple@kiburan.local', crypt('CoupleTestPass1', gen_salt('bf')), now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Sara Hailu"}'::jsonb
  );

  insert into public.profiles (id, display_name)
  values (v_couple, 'Sara Hailu')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into public.weddings (
    id, created_by, title, partner_one_name, partner_two_name, wedding_date, city, celebration_kind
  ) values (
    gen_random_uuid(), v_couple, 'Sara & Yonatan', 'Sara Hailu', 'Yonatan Desta',
    '2026-11-28', 'Addis Ababa', 'wedding'
  )
  returning id into v_wedding;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_wedding, v_couple, 'owner');

  insert into public.wedding_vendors (id, wedding_id, vendor_id, status, notes)
  values (gen_random_uuid(), v_wedding, v_vendor_id, 'booked', 'M8 SQL test')
  returning id into v_wv;

  insert into public.vendor_bookings (
    wedding_vendor_id, booking_date, total_amount, deposit_amount, currency_code, status, notes
  ) values
    (v_wv, current_date + 10, 40000, 10000, 'ETB', 'pending', 'M8 SQL'),
    (v_wv, date_trunc('month', current_date)::date + 5, 55000, 12000, 'ETB', 'confirmed', 'M8 SQL'),
    (v_wv, (date_trunc('month', current_date) - interval '1 month')::date + 8, 30000, null, 'ETB', 'fulfilled', 'M8 SQL');

  insert into public.vendor_reviews (vendor_id, wedding_id, reviewer_id, rating, comment, status)
  values (v_vendor_id, v_wedding, v_couple, 5, 'M8 SQL published review', 'published');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);

  v_reviews := public.vendor_list_reviews(v_vendor_id, 'published', 10, null, null);
  if jsonb_array_length(v_reviews->'items') < 1 then
    raise exception 'expected published review in list';
  end if;
  if (v_reviews->'items'->0->>'reviewer_display_name') is distinct from 'Sara Hailu' then
    raise exception 'expected reviewer name, got %', v_reviews->'items'->0->>'reviewer_display_name';
  end if;
  if (v_reviews->'items'->0->'couple'->>'couple_label') is distinct from 'Sara & Yonatan' then
    raise exception 'expected couple label, got %', v_reviews->'items'->0->'couple'->>'couple_label';
  end if;
  if (v_reviews->>'published_count')::integer < 1 then
    raise exception 'expected published_count >= 1';
  end if;

  v_earnings := public.vendor_earnings_summary(v_vendor_id);
  if (v_earnings->>'pipeline_value')::numeric < 40000 then
    raise exception 'expected pipeline >= 40000, got %', v_earnings->>'pipeline_value';
  end if;
  if (v_earnings->>'confirmed_value')::numeric < 55000 then
    raise exception 'expected confirmed >= 55000, got %', v_earnings->>'confirmed_value';
  end if;
  if (v_earnings->>'completed_value')::numeric < 30000 then
    raise exception 'expected completed >= 30000, got %', v_earnings->>'completed_value';
  end if;
  if (v_earnings->>'agreed_deposits')::numeric < 22000 then
    raise exception 'expected deposits >= 22000, got %', v_earnings->>'agreed_deposits';
  end if;
  if jsonb_typeof(v_earnings->'booking_value_series') <> 'array'
     or jsonb_array_length(v_earnings->'booking_value_series') <> 6 then
    raise exception 'expected 6-month series';
  end if;
end;
$$;

select 'vendor_p6_earnings_reviews ok' as result;

rollback;
