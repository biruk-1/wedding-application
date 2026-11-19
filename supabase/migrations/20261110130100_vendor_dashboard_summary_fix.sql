-- Fix vendor_dashboard_summary: loop variable name collided with review alias `r`.
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
