-- Chapa marketplace payments: ledger, vendor payout fields, deposit on accept, budget bridge.

-- ---------------------------------------------------------------------------
-- Vendor payout / split fields (Chapa subaccounts)
-- ---------------------------------------------------------------------------
alter table public.vendors
  add column if not exists chapa_subaccount_id text,
  add column if not exists payout_account_name text,
  add column if not exists payout_account_number text,
  add column if not exists payout_bank_code text,
  add column if not exists payout_split_type text
    check (payout_split_type is null or payout_split_type in ('percentage', 'flat')),
  add column if not exists payout_split_value numeric(14,4)
    check (payout_split_value is null or payout_split_value >= 0);

comment on column public.vendors.chapa_subaccount_id is
  'Chapa subaccount id for marketplace split payments; null = platform collects full amount.';

-- ---------------------------------------------------------------------------
-- Booking payment ledger
-- ---------------------------------------------------------------------------
create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.vendor_bookings(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  payer_user_id uuid not null references public.profiles(id),
  tx_ref text not null,
  chapa_ref text,
  amount numeric(14,2) not null check (amount > 0),
  currency_code char(3) not null default 'ETB',
  purpose text not null check (purpose in ('deposit', 'balance', 'full')),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'cancelled')),
  checkout_url text,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  expense_payment_id uuid references public.expense_payments(id) on delete set null,
  vendor_subaccount_id text,
  platform_split_type text check (platform_split_type is null or platform_split_type in ('percentage', 'flat')),
  platform_split_value numeric(14,4),
  raw_initialize jsonb,
  raw_webhook jsonb,
  raw_verify jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tx_ref)
);

create index if not exists idx_booking_payments_booking
  on public.booking_payments (booking_id);

create index if not exists idx_booking_payments_wedding
  on public.booking_payments (wedding_id);

create index if not exists idx_booking_payments_status
  on public.booking_payments (status);

drop trigger if exists booking_payments_set_updated_at on public.booking_payments;
create trigger booking_payments_set_updated_at
  before update on public.booking_payments
  for each row execute function private.set_updated_at();

alter table public.booking_payments enable row level security;

drop policy if exists booking_payments_select on public.booking_payments;
create policy booking_payments_select on public.booking_payments
  for select to authenticated
  using (
    private.has_wedding_permission(wedding_id, 'budget.expenses.view')
    or exists (
      select 1
      from public.vendor_bookings b
      join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
      where b.id = booking_id
        and private.is_vendor_team_member(wv.vendor_id)
    )
  );

-- Clients never insert/update payments directly; Edge Functions use service role.
drop policy if exists booking_payments_insert on public.booking_payments;
drop policy if exists booking_payments_update on public.booking_payments;

revoke all on table public.booking_payments from anon;
grant select on table public.booking_payments to authenticated;
grant all on table public.booking_payments to service_role;

-- ---------------------------------------------------------------------------
-- Accept quote: set deposit, create budget line, return richer payload
-- ---------------------------------------------------------------------------
create or replace function public.accept_vendor_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_quote public.vendor_quotes%rowtype;
  v_inquiry public.vendor_inquiries%rowtype;
  v_wv_id uuid;
  v_booking public.vendor_bookings%rowtype;
  v_deposit numeric(14,2);
  v_budget_item public.budget_items%rowtype;
  v_vendor_name text;
  v_category_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into v_quote from public.vendor_quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;
  if v_quote.status is distinct from 'sent' then
    raise exception 'only sent quotes can be accepted';
  end if;

  select * into v_inquiry from public.vendor_inquiries where id = v_quote.inquiry_id for update;
  if not found then raise exception 'inquiry not found'; end if;
  if not private.has_wedding_permission(v_inquiry.wedding_id, 'vendors.manage') then
    raise exception 'wedding permission required to accept quotes';
  end if;

  select business_name into v_vendor_name
  from public.vendors
  where id = v_inquiry.vendor_id;

  select id into v_wv_id
  from public.wedding_vendors
  where wedding_id = v_inquiry.wedding_id
    and vendor_id = v_inquiry.vendor_id
  order by created_at asc
  limit 1;

  if v_inquiry.service_id is not null then
    select category_id into v_category_id
    from public.vendor_services
    where id = v_inquiry.service_id;
  end if;

  if v_wv_id is null then
    insert into public.wedding_vendors (wedding_id, vendor_id, category_id, status)
    values (
      v_inquiry.wedding_id,
      v_inquiry.vendor_id,
      v_category_id,
      'negotiating'
    )
    returning id into v_wv_id;
  else
    update public.wedding_vendors
    set status = 'negotiating',
        category_id = coalesce(category_id, v_category_id)
    where id = v_wv_id;
  end if;

  -- Default deposit: 30% of quote (rounded), or full amount when quote is under 1000 ETB.
  if v_quote.amount is null or v_quote.amount <= 0 then
    v_deposit := null;
  elsif v_quote.amount < 1000 then
    v_deposit := v_quote.amount;
  else
    v_deposit := round(v_quote.amount * 0.30, 2);
    if v_deposit > v_quote.amount then
      v_deposit := v_quote.amount;
    end if;
  end if;

  insert into public.vendor_bookings (
    wedding_vendor_id, quote_id, total_amount, deposit_amount, currency_code, status, notes
  ) values (
    v_wv_id,
    v_quote.id,
    v_quote.amount,
    v_deposit,
    v_quote.currency_code,
    'pending',
    v_quote.description
  )
  returning * into v_booking;

  update public.vendor_quotes
  set status = 'accepted', updated_at = timezone('utc', now())
  where id = v_quote.id;

  update public.vendor_inquiries
  set status = 'accepted', updated_at = timezone('utc', now())
  where id = v_inquiry.id;

  insert into public.budget_items (
    wedding_id,
    wedding_vendor_id,
    booking_id,
    label,
    estimated_amount,
    committed_amount,
    notes
  ) values (
    v_inquiry.wedding_id,
    v_wv_id,
    v_booking.id,
    coalesce(nullif(btrim(v_vendor_name), ''), 'Vendor booking'),
    v_quote.amount,
    v_quote.amount,
    'Created from accepted vendor quote'
  )
  returning * into v_budget_item;

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'quote_id', v_quote.id,
    'inquiry_id', v_inquiry.id,
    'wedding_vendor_id', v_wv_id,
    'budget_item_id', v_budget_item.id,
    'status', v_booking.status,
    'total_amount', v_booking.total_amount,
    'deposit_amount', v_booking.deposit_amount,
    'currency_code', v_booking.currency_code
  );
end;
$$;

revoke all on function public.accept_vendor_quote(uuid) from public, anon;
grant execute on function public.accept_vendor_quote(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Vendor registers / updates Chapa payout destination (managers+)
-- ---------------------------------------------------------------------------
create or replace function public.vendor_set_payout_details(
  p_vendor_id uuid,
  p_account_name text,
  p_account_number text,
  p_bank_code text,
  p_chapa_subaccount_id text default null,
  p_split_type text default 'percentage',
  p_split_value numeric default 0.95
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_row public.vendors%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not private.can_manage_vendor(p_vendor_id) then
    raise exception 'only owners and managers can set payout details';
  end if;
  if p_account_name is null or btrim(p_account_name) = '' then
    raise exception 'account name is required';
  end if;
  if p_account_number is null or btrim(p_account_number) = '' then
    raise exception 'account number is required';
  end if;
  if p_bank_code is null or btrim(p_bank_code) = '' then
    raise exception 'bank code is required';
  end if;
  if p_split_type is distinct from 'percentage' and p_split_type is distinct from 'flat' then
    raise exception 'split type must be percentage or flat';
  end if;
  if p_split_value is null or p_split_value < 0 then
    raise exception 'split value must be zero or greater';
  end if;

  update public.vendors
  set
    payout_account_name = btrim(p_account_name),
    payout_account_number = btrim(p_account_number),
    payout_bank_code = btrim(p_bank_code),
    chapa_subaccount_id = nullif(btrim(coalesce(p_chapa_subaccount_id, '')), ''),
    payout_split_type = p_split_type,
    payout_split_value = p_split_value,
    updated_at = timezone('utc', now())
  where id = p_vendor_id
  returning * into v_row;

  if not found then raise exception 'vendor not found'; end if;

  return jsonb_build_object(
    'vendor_id', v_row.id,
    'chapa_subaccount_id', v_row.chapa_subaccount_id,
    'payout_account_name', v_row.payout_account_name,
    'payout_bank_code', v_row.payout_bank_code,
    'payout_split_type', v_row.payout_split_type,
    'payout_split_value', v_row.payout_split_value
  );
end;
$$;

revoke all on function public.vendor_set_payout_details(uuid, text, text, text, text, text, numeric)
  from public, anon;
grant execute on function public.vendor_set_payout_details(uuid, text, text, text, text, text, numeric)
  to authenticated, service_role;
