-- Milestone 7: remaining P2 vendor read RPCs + P3 inquiry/quote/booking workflow RPCs.
-- Additive. Couple-side accept_vendor_quote is included so the client can adopt it later;
-- the vendor app does not invent bookings without that path.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.first_name(p_full text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(btrim(coalesce(p_full, '')), ' ', 1), '');
$$;

create or replace function private.vendor_couple_projection(
  p_wedding_id uuid,
  p_include_contact boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_wedding record;
  v_inquirer record;
begin
  select
    w.title,
    w.partner_one_name,
    w.partner_two_name,
    w.celebration_kind,
    w.wedding_date,
    w.city
  into v_wedding
  from public.weddings w
  where w.id = p_wedding_id;

  if not found then
    return jsonb_build_object(
      'wedding_title', null,
      'partner_one_first_name', null,
      'partner_two_first_name', null,
      'couple_label', null,
      'celebration_kind', null,
      'wedding_date', null,
      'city', null,
      'inquirer_display_name', null,
      'contact_phone', null,
      'contact_email', null
    );
  end if;

  select p.display_name, p.phone
  into v_inquirer
  from public.weddings w
  join public.profiles p on p.id = w.created_by
  where w.id = p_wedding_id;

  return jsonb_build_object(
    'wedding_title', v_wedding.title,
    'partner_one_first_name', private.first_name(v_wedding.partner_one_name),
    'partner_two_first_name', private.first_name(v_wedding.partner_two_name),
    'couple_label',
      case
        when private.first_name(v_wedding.partner_one_name) is not null
         and private.first_name(v_wedding.partner_two_name) is not null
          then private.first_name(v_wedding.partner_one_name) || ' & ' || private.first_name(v_wedding.partner_two_name)
        else coalesce(private.first_name(v_wedding.partner_one_name), private.first_name(v_wedding.partner_two_name), v_wedding.title)
      end,
    'celebration_kind', v_wedding.celebration_kind,
    'wedding_date', v_wedding.wedding_date,
    'city', v_wedding.city,
    'inquirer_display_name', nullif(btrim(coalesce(v_inquirer.display_name, '')), ''),
    'contact_phone', case when p_include_contact then v_inquirer.phone else null end,
    'contact_email', null
  );
end;
$$;

create or replace function private.vendor_has_confirmed_booking(p_vendor_id uuid, p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    where wv.vendor_id = p_vendor_id
      and wv.wedding_id = p_wedding_id
      and b.status in ('confirmed', 'fulfilled')
  );
$$;

-- ---------------------------------------------------------------------------
-- P2 reads: inquiries
-- ---------------------------------------------------------------------------
create or replace function public.vendor_list_inquiries(
  p_vendor_id uuid,
  p_status text default null,
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
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_vendor_id is null then raise exception 'vendor_id is required'; end if;
  if not private.is_vendor_team_member(p_vendor_id) then
    raise exception 'not a member of this vendor';
  end if;
  if p_status is not null and p_status not in ('new','replied','quoted','accepted','declined','closed') then
    raise exception 'invalid inquiry status filter';
  end if;

  for v_row in
    select
      i.id,
      i.status,
      i.message,
      i.proposed_budget,
      i.created_at,
      i.service_id,
      s.title as service_title,
      i.wedding_id,
      i.requested_event_id,
      e.name as event_name,
      e.starts_at as event_starts_at,
      e.venue_name as event_venue_name
    from public.vendor_inquiries i
    left join public.vendor_services s on s.id = i.service_id
    left join public.wedding_events e on e.id = i.requested_event_id
    where i.vendor_id = p_vendor_id
      and (p_status is null or i.status = p_status)
      and (
        p_cursor_created_at is null
        or (i.created_at, i.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by i.created_at desc, i.id desc
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
        'status', v_row.status,
        'message', v_row.message,
        'proposed_budget', v_row.proposed_budget,
        'created_at', v_row.created_at,
        'service_id', v_row.service_id,
        'service_title', v_row.service_title,
        'wedding_id', v_row.wedding_id,
        'event_name', v_row.event_name,
        'event_starts_at', v_row.event_starts_at,
        'event_venue_name', v_row.event_venue_name,
        'couple', private.vendor_couple_projection(
          v_row.wedding_id,
          private.vendor_has_confirmed_booking(p_vendor_id, v_row.wedding_id)
        )
      )
    );
  end loop;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next);
end;
$$;

create or replace function public.vendor_get_inquiry(p_inquiry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_quotes jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_inquiry_id is null then raise exception 'inquiry_id is required'; end if;

  select
    i.id,
    i.vendor_id,
    i.status,
    i.message,
    i.proposed_budget,
    i.created_at,
    i.service_id,
    s.title as service_title,
    i.wedding_id,
    i.requested_event_id,
    e.name as event_name,
    e.starts_at as event_starts_at,
    e.venue_name as event_venue_name
  into v_row
  from public.vendor_inquiries i
  left join public.vendor_services s on s.id = i.service_id
  left join public.wedding_events e on e.id = i.requested_event_id
  where i.id = p_inquiry_id;

  if not found then
    return null;
  end if;
  if not private.is_vendor_team_member(v_row.vendor_id) then
    raise exception 'not a member of this vendor';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'amount', q.amount,
      'currency_code', q.currency_code,
      'description', q.description,
      'package_id', q.package_id,
      'package_name', p.name,
      'status', q.status,
      'valid_until', q.valid_until,
      'created_at', q.created_at
    ) order by q.created_at desc
  ), '[]'::jsonb)
  into v_quotes
  from public.vendor_quotes q
  left join public.vendor_packages p on p.id = q.package_id
  where q.inquiry_id = v_row.id;

  return jsonb_build_object(
    'id', v_row.id,
    'vendor_id', v_row.vendor_id,
    'status', v_row.status,
    'message', v_row.message,
    'proposed_budget', v_row.proposed_budget,
    'created_at', v_row.created_at,
    'service_id', v_row.service_id,
    'service_title', v_row.service_title,
    'wedding_id', v_row.wedding_id,
    'event_name', v_row.event_name,
    'event_starts_at', v_row.event_starts_at,
    'event_venue_name', v_row.event_venue_name,
    'couple', private.vendor_couple_projection(
      v_row.wedding_id,
      private.vendor_has_confirmed_booking(v_row.vendor_id, v_row.wedding_id)
    ),
    'quotes', v_quotes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- P2 reads: bookings
-- ---------------------------------------------------------------------------
create or replace function public.vendor_list_bookings(
  p_vendor_id uuid,
  p_status text default null,
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
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_vendor_id is null then raise exception 'vendor_id is required'; end if;
  if not private.is_vendor_team_member(p_vendor_id) then
    raise exception 'not a member of this vendor';
  end if;
  if p_status is not null and p_status not in ('pending','confirmed','fulfilled','cancelled') then
    raise exception 'invalid booking status filter';
  end if;

  for v_row in
    select
      b.id,
      b.status,
      b.booking_date,
      b.start_at,
      b.end_at,
      b.total_amount,
      b.deposit_amount,
      b.currency_code,
      b.notes,
      b.contract_storage_path,
      b.created_at,
      b.quote_id,
      wv.wedding_id,
      wv.category_id,
      c.name_en as category_name,
      q.description as quote_description,
      pk.name as package_name,
      s.id as service_id,
      s.title as service_title,
      s.description as service_description
    from public.vendor_bookings b
    join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
    left join public.vendor_categories c on c.id = wv.category_id
    left join public.vendor_quotes q on q.id = b.quote_id
    left join public.vendor_packages pk on pk.id = q.package_id
    left join public.vendor_services s on s.id = pk.service_id
    where wv.vendor_id = p_vendor_id
      and (p_status is null or b.status = p_status)
      and (
        p_cursor_created_at is null
        or (b.created_at, b.id) < (p_cursor_created_at, p_cursor_id)
      )
    order by b.created_at desc, b.id desc
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
        'status', v_row.status,
        'booking_date', v_row.booking_date,
        'start_at', v_row.start_at,
        'end_at', v_row.end_at,
        'total_amount', v_row.total_amount,
        'deposit_amount', v_row.deposit_amount,
        'currency_code', v_row.currency_code,
        'notes', v_row.notes,
        'has_contract', v_row.contract_storage_path is not null,
        'created_at', v_row.created_at,
        'quote_id', v_row.quote_id,
        'package_name', v_row.package_name,
        'service_id', v_row.service_id,
        'service_title', coalesce(v_row.service_title, v_row.category_name, 'Booking'),
        'service_description', coalesce(v_row.quote_description, v_row.service_description),
        'wedding_id', v_row.wedding_id,
        'couple', private.vendor_couple_projection(
          v_row.wedding_id,
          v_row.status in ('confirmed', 'fulfilled')
        )
      )
    );
  end loop;

  return jsonb_build_object('items', v_items, 'next_cursor', v_next);
end;
$$;

create or replace function public.vendor_get_booking(p_booking_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_booking_id is null then raise exception 'booking_id is required'; end if;

  select
    b.id,
    b.status,
    b.booking_date,
    b.start_at,
    b.end_at,
    b.total_amount,
    b.deposit_amount,
    b.currency_code,
    b.notes,
    b.contract_storage_path,
    b.created_at,
    b.quote_id,
    wv.vendor_id,
    wv.wedding_id,
    c.name_en as category_name,
    q.description as quote_description,
    pk.name as package_name,
    s.id as service_id,
    s.title as service_title,
    s.description as service_description
  into v_row
  from public.vendor_bookings b
  join public.wedding_vendors wv on wv.id = b.wedding_vendor_id
  left join public.vendor_categories c on c.id = wv.category_id
  left join public.vendor_quotes q on q.id = b.quote_id
  left join public.vendor_packages pk on pk.id = q.package_id
  left join public.vendor_services s on s.id = pk.service_id
  where b.id = p_booking_id;

  if not found then
    return null;
  end if;
  if not private.is_vendor_team_member(v_row.vendor_id) then
    raise exception 'not a member of this vendor';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'vendor_id', v_row.vendor_id,
    'status', v_row.status,
    'booking_date', v_row.booking_date,
    'start_at', v_row.start_at,
    'end_at', v_row.end_at,
    'total_amount', v_row.total_amount,
    'deposit_amount', v_row.deposit_amount,
    'currency_code', v_row.currency_code,
    'notes', v_row.notes,
    'has_contract', v_row.contract_storage_path is not null,
    'created_at', v_row.created_at,
    'quote_id', v_row.quote_id,
    'package_name', v_row.package_name,
    'service_id', v_row.service_id,
    'service_title', coalesce(v_row.service_title, v_row.category_name, 'Booking'),
    'service_description', coalesce(v_row.quote_description, v_row.service_description),
    'wedding_id', v_row.wedding_id,
    'couple', private.vendor_couple_projection(
      v_row.wedding_id,
      v_row.status in ('confirmed', 'fulfilled')
    )
  );
end;
$$;

revoke all on function public.vendor_list_inquiries(uuid, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.vendor_get_inquiry(uuid) from public, anon;
revoke all on function public.vendor_list_bookings(uuid, text, integer, timestamptz, uuid) from public, anon;
revoke all on function public.vendor_get_booking(uuid) from public, anon;
grant execute on function public.vendor_list_inquiries(uuid, text, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.vendor_get_inquiry(uuid) to authenticated, service_role;
grant execute on function public.vendor_list_bookings(uuid, text, integer, timestamptz, uuid) to authenticated, service_role;
grant execute on function public.vendor_get_booking(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P3 workflows
-- ---------------------------------------------------------------------------
create or replace function public.vendor_update_inquiry_status(
  p_inquiry_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_inquiry public.vendor_inquiries%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_status is null or p_status not in ('replied', 'declined', 'closed') then
    raise exception 'status must be replied, declined, or closed';
  end if;

  select * into v_inquiry from public.vendor_inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'inquiry not found'; end if;
  if not private.is_vendor_team_member(v_inquiry.vendor_id) then
    raise exception 'not a member of this vendor';
  end if;
  if v_inquiry.status is distinct from 'new' then
    raise exception 'only new inquiries can change status this way';
  end if;

  update public.vendor_inquiries
  set status = p_status, updated_at = timezone('utc', now())
  where id = p_inquiry_id
  returning * into v_inquiry;

  return public.vendor_get_inquiry(v_inquiry.id);
end;
$$;

create or replace function public.vendor_send_quote(
  p_inquiry_id uuid,
  p_amount numeric,
  p_package_id uuid default null,
  p_description text default null,
  p_valid_until date default null,
  p_currency_code text default 'ETB'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_inquiry public.vendor_inquiries%rowtype;
  v_quote public.vendor_quotes%rowtype;
  v_pkg_vendor uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'amount must be zero or greater'; end if;

  select * into v_inquiry from public.vendor_inquiries where id = p_inquiry_id for update;
  if not found then raise exception 'inquiry not found'; end if;
  if not private.can_manage_vendor(v_inquiry.vendor_id) then
    raise exception 'only owners and managers can send quotes';
  end if;
  if v_inquiry.status in ('declined', 'closed') then
    raise exception 'cannot quote a declined or closed inquiry';
  end if;

  if p_package_id is not null then
    select s.vendor_id into v_pkg_vendor
    from public.vendor_packages pk
    join public.vendor_services s on s.id = pk.service_id
    where pk.id = p_package_id;
    if v_pkg_vendor is null then raise exception 'package not found'; end if;
    if v_pkg_vendor is distinct from v_inquiry.vendor_id then
      raise exception 'package must belong to this vendor';
    end if;
  end if;

  insert into public.vendor_quotes (
    inquiry_id, package_id, amount, currency_code, description, valid_until, status
  ) values (
    p_inquiry_id,
    p_package_id,
    p_amount,
    coalesce(nullif(btrim(p_currency_code), ''), 'ETB'),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_valid_until,
    'sent'
  )
  returning * into v_quote;

  update public.vendor_inquiries
  set status = 'quoted', updated_at = timezone('utc', now())
  where id = p_inquiry_id;

  return public.vendor_get_inquiry(p_inquiry_id);
end;
$$;

create or replace function public.vendor_respond_booking(
  p_booking_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_booking public.vendor_bookings%rowtype;
  v_vendor_id uuid;
  v_wedding_id uuid;
  v_new_status text;
  v_wv_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_action is null or p_action not in ('confirm', 'decline', 'fulfil') then
    raise exception 'action must be confirm, decline, or fulfil';
  end if;

  select b.* into v_booking from public.vendor_bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'booking not found'; end if;

  select wv.vendor_id, wv.wedding_id into v_vendor_id, v_wedding_id
  from public.wedding_vendors wv
  where wv.id = v_booking.wedding_vendor_id;
  if v_vendor_id is null then raise exception 'booking vendor link missing'; end if;
  if not private.can_manage_vendor(v_vendor_id) then
    raise exception 'only owners and managers can respond to bookings';
  end if;

  if p_action = 'confirm' then
    if v_booking.status is distinct from 'pending' then
      raise exception 'only pending bookings can be confirmed';
    end if;
    v_new_status := 'confirmed';
    v_wv_status := 'booked';
  elsif p_action = 'decline' then
    if v_booking.status is distinct from 'pending' then
      raise exception 'only pending bookings can be declined';
    end if;
    v_new_status := 'cancelled';
    v_wv_status := 'cancelled';
  else
    if v_booking.status is distinct from 'confirmed' then
      raise exception 'only confirmed bookings can be fulfilled';
    end if;
    v_new_status := 'fulfilled';
    v_wv_status := 'completed';
  end if;

  update public.vendor_bookings
  set
    status = v_new_status,
    notes = case
      when p_note is null or btrim(p_note) = '' then notes
      when notes is null or btrim(notes) = '' then btrim(p_note)
      else notes || E'\n' || btrim(p_note)
    end,
    updated_at = timezone('utc', now())
  where id = p_booking_id
  returning * into v_booking;

  update public.wedding_vendors
  set status = v_wv_status
  where id = v_booking.wedding_vendor_id;

  if p_action = 'confirm'
     and v_booking.start_at is not null
     and v_booking.end_at is not null
     and v_booking.end_at > v_booking.start_at then
    insert into public.vendor_availability (
      vendor_id, starts_at, ends_at, status, notes
    ) values (
      v_vendor_id,
      v_booking.start_at,
      v_booking.end_at,
      'booked',
      'Auto-blocked from confirmed booking'
    );
  end if;

  return public.vendor_get_booking(p_booking_id);
end;
$$;

-- Couple-side acceptance (client app must call this; vendor app documents the gap).
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

  select id into v_wv_id
  from public.wedding_vendors
  where wedding_id = v_inquiry.wedding_id
    and vendor_id = v_inquiry.vendor_id
  order by created_at asc
  limit 1;

  if v_wv_id is null then
    insert into public.wedding_vendors (wedding_id, vendor_id, category_id, status)
    values (
      v_inquiry.wedding_id,
      v_inquiry.vendor_id,
      (select category_id from public.vendor_services where id = v_inquiry.service_id),
      'negotiating'
    )
    returning id into v_wv_id;
  else
    update public.wedding_vendors
    set status = 'negotiating'
    where id = v_wv_id;
  end if;

  insert into public.vendor_bookings (
    wedding_vendor_id, quote_id, total_amount, currency_code, status, notes
  ) values (
    v_wv_id,
    v_quote.id,
    v_quote.amount,
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

  return jsonb_build_object(
    'booking_id', v_booking.id,
    'quote_id', v_quote.id,
    'inquiry_id', v_inquiry.id,
    'wedding_vendor_id', v_wv_id,
    'status', v_booking.status
  );
end;
$$;

revoke all on function public.vendor_update_inquiry_status(uuid, text) from public, anon;
revoke all on function public.vendor_send_quote(uuid, numeric, uuid, text, date, text) from public, anon;
revoke all on function public.vendor_respond_booking(uuid, text, text) from public, anon;
revoke all on function public.accept_vendor_quote(uuid) from public, anon;
grant execute on function public.vendor_update_inquiry_status(uuid, text) to authenticated, service_role;
grant execute on function public.vendor_send_quote(uuid, numeric, uuid, text, date, text) to authenticated, service_role;
grant execute on function public.vendor_respond_booking(uuid, text, text) to authenticated, service_role;
grant execute on function public.accept_vendor_quote(uuid) to authenticated, service_role;
