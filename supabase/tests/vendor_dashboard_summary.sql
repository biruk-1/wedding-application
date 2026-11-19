-- Local check for vendor_dashboard_summary. Rolls back.
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
  v_summary jsonb;
begin
  perform pg_temp.as_user('11111111-1111-4111-8111-111111111111');
  v_summary := public.vendor_dashboard_summary('22222222-2222-4222-8222-222222222221');
  if (v_summary ->> 'new_inquiries')::int < 0 then
    raise exception 'bad new_inquiries';
  end if;
  if jsonb_typeof(v_summary -> 'booking_value_series') <> 'array' then
    raise exception 'series missing';
  end if;
  if jsonb_array_length(v_summary -> 'booking_value_series') <> 6 then
    raise exception 'series length';
  end if;
end;
$$;

rollback;
select 'vendor_dashboard_summary ok' as result;
