-- Milestone 8: P6 booking-value earnings summary + vendor review list RPC.
-- No payment ledger. No P5 messaging tables (Messages stay Inquiries until both apps ship chat).

-- ---------------------------------------------------------------------------
-- Reviews list (reviewer + couple projection; vendors cannot join profiles via RLS)
-- ---------------------------------------------------------------------------
create or replace function public.vendor_list_reviews(
  p_vendor_id uuid,
  p_status text default 'published',
  p_limit integer default 20,
  p_cursor_created_at timestamptz default null,
  p_cursor_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
  v_items jsonb := '[]'::jsonb;
  v_row record;
  v_count integer := 0;
  v_next jsonb := null;
  v_published_count integer := 0;
  v_published_average numeric := null;
  v_pending_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_vendor_id is null then raise exception 'vendor_id is required'; end if;
  if not private.is_vendor_team_member(p_vendor_id) then
    raise exception 'not a member of this vendor';
  end if;
  if p_status is not null and p_status not in ('published', 'pending', 'hidden') then
    raise exception 'invalid review status filter';
  end if;

  select
    count(*) filter (where vr.status = 'published')::integer,
    case
      when count(*) filter (where vr.status = 'published') = 0 then null
      else round((avg(vr.rating) filter (where vr.status = 'published'))::numeric, 1)
    end,
    count(*) filter (where vr.status = 'pending')::integer
  into v_published_count, v_published_average, v_pending_count
  from public.vendor_reviews vr
  where vr.vendor_id = p_vendor_id;

  for v_row in
    select
      vr.id,
      vr.rating,
      vr.comment,
      vr.status,
      vr.created_at,
      vr.wedding_id,
      vr.reviewer_id,
      nullif(btrim(coalesce(p.display_name, '')), '') as reviewer_display_name
    from public.vendor_reviews vr
    left join public.profiles p on p.id = vr.reviewer_id
    where vr.vendor_id = p_vendor_id
      and (p_status is null or vr.status = p_status)
      and (
        p_cursor_created_at is null
        or (vr.created_at, vr.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by vr.created_at desc, vr.id desc
    limit v_limit + 1
  loop
    v_count := v_count + 1;
    if v_count > v_limit then
      v_next := jsonb_build_object('created_at', v_row.created_at, 'id', v_row.id);
      exit;
    end if;
    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'id', v_row.id,
        'rating', v_row.rating,
        'comment', v_row.comment,
        'status', v_row.status,
        'created_at', v_row.created_at,
        'wedding_id', v_row.wedding_id,
        'reviewer_id', v_row.reviewer_id,
        'reviewer_display_name', v_row.reviewer_display_name,
        'couple', private.vendor_couple_projection(v_row.wedding_id, false)
      )
    );
  end loop;

  return jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next,
    'published_count', v_published_count,
    'published_average', v_published_average,
    'pending_count', v_pending_count
  );
end;
$$;

revoke all on function public.vendor_list_reviews(uuid, text, integer, timestamptz, uuid)
  from public, anon;
grant execute on function public.vendor_list_reviews(uuid, text, integer, timestamptz, uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P6 earnings: agreed booking values only (not payments received)
-- ---------------------------------------------------------------------------
create or replace function public.vendor_earnings_summary(p_vendor_id uuid)
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
  v_pipeline numeric := 0;
  v_confirmed numeric := 0;
  v_completed numeric := 0;
  v_deposits numeric := 0;
  v_pending_count integer := 0;
  v_confirmed_count integer := 0;
  v_fulfilled_count integer := 0;
  v_this_month numeric := 0;
  v_last_month numeric := 0;
  v_has_other boolean := false;
  v_series numeric[] := array[0, 0, 0, 0, 0, 0];
  v_row record;
  v_idx integer;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  if p_vendor_id is null then raise exception 'vendor_id is required'; end if;
  if not private.is_vendor_team_member(p_vendor_id) then
    raise exception 'not a member of this vendor';
  end if;

  for v_row in
    select b.status, b.booking_date, b.total_amount, b.deposit_amount, b.currency_code
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where wv.vendor_id = p_vendor_id
  loop
    if v_row.currency_code is distinct from 'ETB' then
      v_has_other := true;
      continue;
    end if;

    if v_row.status = 'pending' then
      v_pending_count := v_pending_count + 1;
      if v_row.total_amount is not null then
        v_pipeline := v_pipeline + v_row.total_amount;
      end if;
    elsif v_row.status = 'confirmed' then
      v_confirmed_count := v_confirmed_count + 1;
      if v_row.total_amount is not null then
        v_confirmed := v_confirmed + v_row.total_amount;
      end if;
    elsif v_row.status = 'fulfilled' then
      v_fulfilled_count := v_fulfilled_count + 1;
      if v_row.total_amount is not null then
        v_completed := v_completed + v_row.total_amount;
      end if;
    end if;

    if v_row.status in ('pending', 'confirmed', 'fulfilled') and v_row.deposit_amount is not null then
      v_deposits := v_deposits + v_row.deposit_amount;
    end if;

    if v_row.status in ('confirmed', 'fulfilled')
       and v_row.booking_date is not null
       and v_row.total_amount is not null
       and v_row.booking_date >= v_series_start
    then
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
    end if;
  end loop;

  return jsonb_build_object(
    'currency_code', 'ETB',
    'pipeline_value', v_pipeline,
    'confirmed_value', v_confirmed,
    'completed_value', v_completed,
    'agreed_deposits', v_deposits,
    'pending_bookings', v_pending_count,
    'confirmed_bookings', v_confirmed_count,
    'fulfilled_bookings', v_fulfilled_count,
    'booking_value_this_month', v_this_month,
    'booking_value_last_month', v_last_month,
    'booking_value_series', to_jsonb(v_series),
    'has_other_currencies', v_has_other
  );
end;
$$;

revoke all on function public.vendor_earnings_summary(uuid) from public, anon;
grant execute on function public.vendor_earnings_summary(uuid) to authenticated, service_role;
