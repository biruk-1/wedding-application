-- Smoke test for Chapa payment migration pieces (run via db:test harness if wired).
do $$
begin
  if to_regclass('public.booking_payments') is null then
    raise exception 'booking_payments table missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vendors' and column_name = 'chapa_subaccount_id'
  ) then
    raise exception 'vendors.chapa_subaccount_id missing';
  end if;
  if to_regprocedure('public.vendor_set_payout_details(uuid,text,text,text,text,text,numeric)') is null then
    raise exception 'vendor_set_payout_details missing';
  end if;
end $$;
