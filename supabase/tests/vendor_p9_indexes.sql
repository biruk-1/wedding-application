-- Smoke: P9 indexes and updated_at columns exist.
begin;

do $$
begin
  if to_regclass('public.idx_wedding_vendors_vendor') is null then
    raise exception 'missing idx_wedding_vendors_vendor';
  end if;
  if to_regclass('public.idx_vendor_bookings_wedding_vendor') is null then
    raise exception 'missing idx_vendor_bookings_wedding_vendor';
  end if;
  if to_regclass('public.idx_vendor_quotes_inquiry') is null then
    raise exception 'missing idx_vendor_quotes_inquiry';
  end if;
  if to_regclass('public.idx_vendor_media_vendor_sort') is null then
    raise exception 'missing idx_vendor_media_vendor_sort';
  end if;
  if to_regclass('public.idx_vendor_packages_service') is null then
    raise exception 'missing idx_vendor_packages_service';
  end if;
  if to_regclass('public.idx_vendor_inquiries_vendor_created') is null then
    raise exception 'missing idx_vendor_inquiries_vendor_created';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vendor_services' and column_name = 'updated_at'
  ) then
    raise exception 'vendor_services.updated_at missing';
  end if;
end $$;

select 'vendor_p9_indexes ok' as result;

rollback;
