-- Milestone 5 prerequisites:
--   P2 (partial): vendor_dashboard_summary RPC
--   P4: vendor-public (+ vendor-private contracts) storage buckets
-- Additive only. Inquiry/booking list RPCs remain for Milestone 7.

-- ---------------------------------------------------------------------------
-- 1. Dashboard summary (one round trip for operational counts + booking value)
-- ---------------------------------------------------------------------------
create or replace function public.vendor_dashboard_summary(p_vendor_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now date := (timezone('utc', now()))::date;
  v_month_start date := date_trunc('month', v_now)::date;
  v_prev_start date := (date_trunc('month', v_now) - interval '1 month')::date;
  v_series_start date := (date_trunc('month', v_now) - interval '5 months')::date;
  v_new_inquiries integer := 0;
  v_pending integer := 0;
  v_confirmed integer := 0;
  v_fulfilled integer := 0;
  v_cancelled integer := 0;
  v_review_count integer := 0;
  v_review_average numeric := null;
  v_this_month numeric := 0;
  v_last_month numeric := 0;
  v_has_other boolean := false;
  v_series numeric[] := array[0, 0, 0, 0, 0, 0];
  v_row record;
  v_idx integer;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if p_vendor_id is null then
    raise exception 'vendor_id is required';
  end if;
  if not private.is_vendor_team_member(p_vendor_id) then
    raise exception 'not a member of this vendor';
  end if;

  select count(*)::integer into v_new_inquiries
  from public.vendor_inquiries i
  where i.vendor_id = p_vendor_id and i.status = 'new';

  select
    count(*) filter (where b.status = 'pending')::integer,
    count(*) filter (where b.status = 'confirmed')::integer,
    count(*) filter (where b.status = 'fulfilled')::integer,
    count(*) filter (where b.status = 'cancelled')::integer
  into v_pending, v_confirmed, v_fulfilled, v_cancelled
  from public.vendor_bookings b
  join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
  where wv.vendor_id = p_vendor_id;

  select
    count(*)::integer,
    case when count(*) = 0 then null else round(avg(vr.rating)::numeric, 1) end
  into v_review_count, v_review_average
  from public.vendor_reviews vr
  where vr.vendor_id = p_vendor_id and vr.status = 'published';

  for v_row in
    select b.booking_date, b.total_amount, b.currency_code
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where wv.vendor_id = p_vendor_id
      and b.status in ('confirmed', 'fulfilled')
      and b.booking_date is not null
      and b.booking_date >= v_series_start
  loop
    if v_row.currency_code is distinct from 'ETB' then
      v_has_other := true;
      continue;
    end if;
    if v_row.total_amount is null then
      continue;
    end if;
    v_idx := (
      (extract(year from v_row.booking_date)::integer - extract(year from v_series_start)::integer) * 12
      + (extract(month from v_row.booking_date)::integer - extract(month from v_series_start)::integer)
    );
    if v_idx between 0 and 5 then
      v_series[v_idx + 1] := v_series[v_idx + 1] + v_row.total_amount;
    end if;
    if v_row.booking_date >= v_month_start then
      v_this_month := v_this_month + v_row.total_amount;
    elsif v_row.booking_date >= v_prev_start then
      v_last_month := v_last_month + v_row.total_amount;
    end if;
  end loop;

  return jsonb_build_object(
    'new_inquiries', v_new_inquiries,
    'pending_bookings', v_pending,
    'confirmed_bookings', v_confirmed,
    'fulfilled_bookings', v_fulfilled,
    'cancelled_bookings', v_cancelled,
    'active_bookings', v_pending + v_confirmed,
    'review_count', v_review_count,
    'review_average', v_review_average,
    'currency_code', 'ETB',
    'booking_value_this_month', v_this_month,
    'booking_value_last_month', v_last_month,
    'booking_value_series', to_jsonb(v_series),
    'has_other_currencies', v_has_other
  );
end;
$$;

revoke all on function public.vendor_dashboard_summary(uuid) from public, anon;
grant execute on function public.vendor_dashboard_summary(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vendor-public',
    'vendor-public',
    true,
    5242880, -- 5 MiB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'vendor-private',
    'vendor-private',
    false,
    20971520, -- 20 MiB
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public marketing images (logo / cover / portfolio)
create policy vendor_public_select on storage.objects
  for select to public
  using (bucket_id = 'vendor-public');

create policy vendor_public_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-public'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );

create policy vendor_public_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vendor-public'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'vendor-public'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );

create policy vendor_public_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vendor-public'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );

-- Private contracts: vendor team of first folder segment
create policy vendor_private_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vendor-private'
    and private.is_vendor_team_member((storage.foldername(name))[1]::uuid)
  );

create policy vendor_private_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'vendor-private'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );

create policy vendor_private_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'vendor-private'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'vendor-private'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );

create policy vendor_private_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'vendor-private'
    and private.can_manage_vendor((storage.foldername(name))[1]::uuid)
  );
