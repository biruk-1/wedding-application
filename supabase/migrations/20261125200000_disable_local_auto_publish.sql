-- Stop local auto-verify/publish. Vendors must stay `pending` until
-- kiburan-admin approves them (service_role). The old trigger lived only in
-- seed.sql for local convenience and broke the real verification queue.

drop trigger if exists vendors_local_auto_publish on public.vendors;
drop function if exists private.local_auto_publish_pending_vendor();
