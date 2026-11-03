-- Guest invitation token RPCs (reviewed extension; does not edit kiburan_schema.sql).
-- Mirrors the collaborator-invite pattern: server hashes tokens; raw token returned once.
-- Public RSVP uses security-definer RPCs granted to anon — never table policies on guests.

-- Create a guest invitation; returns the raw token once. Writers only.
create or replace function public.create_guest_invitation(
  p_wedding_id uuid,
  p_guest_id uuid default null,
  p_group_id uuid default null,
  p_design_id uuid default null,
  p_event_ids uuid[] default null,
  p_delivery_channel text default 'link'
)
returns table (invitation_id uuid, raw_token text)
language plpgsql
security definer
set search_path = public, extensions, private
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_event_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;
  if not private.can_write_wedding(p_wedding_id) then
    raise exception 'not authorized to create invitations for this wedding';
  end if;
  if p_guest_id is null and p_group_id is null then
    raise exception 'guest_id or group_id is required';
  end if;
  if p_delivery_channel is not null
     and p_delivery_channel not in ('link','sms','whatsapp','email','print','other') then
    raise exception 'invalid delivery_channel';
  end if;

  if p_guest_id is not null then
    if not exists (
      select 1 from public.guests g
      where g.id = p_guest_id and g.wedding_id = p_wedding_id
    ) then
      raise exception 'guest does not belong to this wedding';
    end if;
  end if;

  if p_group_id is not null then
    if not exists (
      select 1 from public.guest_groups gg
      where gg.id = p_group_id and gg.wedding_id = p_wedding_id
    ) then
      raise exception 'group does not belong to this wedding';
    end if;
  end if;

  if p_design_id is not null then
    if not exists (
      select 1 from public.invitation_designs d
      where d.id = p_design_id and d.wedding_id = p_wedding_id
    ) then
      raise exception 'design does not belong to this wedding';
    end if;
  end if;

  if p_event_ids is not null then
    foreach v_event_id in array p_event_ids loop
      if not exists (
        select 1 from public.wedding_events e
        where e.id = v_event_id and e.wedding_id = p_wedding_id
      ) then
        raise exception 'event does not belong to this wedding';
      end if;
    end loop;
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.invitations (
    wedding_id, guest_id, group_id, design_id, token_hash, delivery_channel, status
  ) values (
    p_wedding_id, p_guest_id, p_group_id, p_design_id, v_hash,
    coalesce(p_delivery_channel, 'link'), 'ready'
  )
  returning id into v_id;

  if p_event_ids is not null then
    foreach v_event_id in array p_event_ids loop
      insert into public.invitation_events (invitation_id, event_id)
      values (v_id, v_event_id)
      on conflict do nothing;
    end loop;
  end if;

  invitation_id := v_id;
  raw_token := v_token;
  return next;
end;
$$;

revoke all on function public.create_guest_invitation(uuid, uuid, uuid, uuid, uuid[], text) from public;
grant execute on function public.create_guest_invitation(uuid, uuid, uuid, uuid, uuid[], text) to authenticated;

-- Mark an invitation as sent after the planner shares the link (no delivery provider).
-- Returns a safe jsonb payload — never token_hash.
create or replace function public.mark_guest_invitation_sent(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_invite public.invitations;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_invite from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if not private.can_write_wedding(v_invite.wedding_id) then
    raise exception 'not authorized';
  end if;
  if v_invite.status = 'cancelled' then
    raise exception 'invitation is cancelled';
  end if;

  update public.invitations
  set status = case
        when status in ('draft', 'ready') then 'sent'
        else status
      end,
      sent_at = coalesce(sent_at, now())
  where id = p_invitation_id
  returning * into v_invite;

  return jsonb_build_object(
    'id', v_invite.id,
    'wedding_id', v_invite.wedding_id,
    'guest_id', v_invite.guest_id,
    'group_id', v_invite.group_id,
    'design_id', v_invite.design_id,
    'delivery_channel', v_invite.delivery_channel,
    'status', v_invite.status,
    'sent_at', v_invite.sent_at,
    'delivered_at', v_invite.delivered_at,
    'opened_at', v_invite.opened_at,
    'created_at', v_invite.created_at
  );
end;
$$;

revoke all on function public.mark_guest_invitation_sent(uuid) from public;
grant execute on function public.mark_guest_invitation_sent(uuid) to authenticated;

-- Public (anon) invitation preview by raw token. Never returns token_hash or other weddings' guests.
create or replace function public.get_guest_invitation_by_token(p_raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite public.invitations;
  v_wedding public.weddings;
  v_design public.invitation_designs;
  v_events jsonb;
  v_guests jsonb;
begin
  if p_raw_token is null or length(trim(p_raw_token)) = 0 then
    raise exception 'token is required';
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.invitations i
  where i.token_hash = v_hash
  for update;

  if not found then
    raise exception 'invalid invitation token';
  end if;
  if v_invite.status = 'cancelled' then
    raise exception 'invitation has been cancelled';
  end if;

  -- Record first open without inventing a separate event-log table.
  if v_invite.opened_at is null and v_invite.status <> 'cancelled' then
    update public.invitations
    set opened_at = now(),
        status = case
          when status in ('draft', 'ready', 'sent', 'delivered') then 'opened'
          else status
        end
    where id = v_invite.id
    returning * into v_invite;
  end if;

  select * into v_wedding from public.weddings where id = v_invite.wedding_id;
  select * into v_design from public.invitation_designs where id = v_invite.design_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'event_type', e.event_type,
      'starts_at', e.starts_at,
      'venue_name', e.venue_name,
      'city', e.city
    ) order by e.sort_order, e.starts_at nulls last
  ), '[]'::jsonb)
  into v_events
  from public.invitation_events ie
  join public.wedding_events e on e.id = ie.event_id
  where ie.invitation_id = v_invite.id;

  -- If no invitation_events rows, fall back to all wedding events for RSVP options.
  if v_events = '[]'::jsonb then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'event_type', e.event_type,
        'starts_at', e.starts_at,
        'venue_name', e.venue_name,
        'city', e.city
      ) order by e.sort_order, e.starts_at nulls last
    ), '[]'::jsonb)
    into v_events
    from public.wedding_events e
    where e.wedding_id = v_invite.wedding_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'full_name', g.full_name,
      'plus_one_allowed', g.plus_one_allowed,
      'rsvps', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'event_id', r.event_id,
            'response', r.response,
            'responded_at', r.responded_at
          )
        )
        from public.guest_rsvps r
        where r.guest_id = g.id
      ), '[]'::jsonb)
    ) order by g.full_name
  ), '[]'::jsonb)
  into v_guests
  from public.guests g
  where g.wedding_id = v_invite.wedding_id
    and (
      (v_invite.guest_id is not null and g.id = v_invite.guest_id)
      or (v_invite.group_id is not null and g.group_id = v_invite.group_id)
    );

  return jsonb_build_object(
    'invitation_id', v_invite.id,
    'status', v_invite.status,
    'opened_at', v_invite.opened_at,
    'wedding', jsonb_build_object(
      'title', v_wedding.title,
      'partner_one_name', v_wedding.partner_one_name,
      'partner_two_name', v_wedding.partner_two_name,
      'wedding_date', v_wedding.wedding_date,
      'city', v_wedding.city,
      'country_code', v_wedding.country_code
    ),
    'design', case
      when v_design.id is null then null
      else jsonb_build_object(
        'id', v_design.id,
        'name', v_design.name,
        'design_data', v_design.design_data
      )
    end,
    'events', v_events,
    'guests', v_guests
  );
end;
$$;

revoke all on function public.get_guest_invitation_by_token(text) from public;
grant execute on function public.get_guest_invitation_by_token(text) to anon, authenticated;

-- Submit / update RSVP for a guest authorized by the invitation token.
create or replace function public.submit_guest_invitation_rsvp(
  p_raw_token text,
  p_guest_id uuid,
  p_event_id uuid,
  p_response text
)
returns public.guest_rsvps
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite public.invitations;
  v_guest public.guests;
  v_allowed boolean := false;
  v_event_ok boolean := false;
  v_row public.guest_rsvps;
begin
  if p_raw_token is null or length(trim(p_raw_token)) = 0 then
    raise exception 'token is required';
  end if;
  if p_response is null or p_response not in ('pending', 'yes', 'no', 'maybe') then
    raise exception 'invalid response';
  end if;

  v_hash := encode(digest(p_raw_token, 'sha256'), 'hex');

  select * into v_invite
  from public.invitations i
  where i.token_hash = v_hash
  for update;

  if not found then
    raise exception 'invalid invitation token';
  end if;
  if v_invite.status = 'cancelled' then
    raise exception 'invitation has been cancelled';
  end if;

  select * into v_guest from public.guests where id = p_guest_id;
  if not found or v_guest.wedding_id <> v_invite.wedding_id then
    raise exception 'guest is not part of this invitation';
  end if;

  if v_invite.guest_id is not null and v_invite.guest_id = p_guest_id then
    v_allowed := true;
  elsif v_invite.group_id is not null and v_guest.group_id = v_invite.group_id then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'guest is not part of this invitation';
  end if;

  if exists (
    select 1 from public.invitation_events ie
    where ie.invitation_id = v_invite.id
  ) then
    v_event_ok := exists (
      select 1 from public.invitation_events ie
      where ie.invitation_id = v_invite.id and ie.event_id = p_event_id
    );
  else
    v_event_ok := exists (
      select 1 from public.wedding_events e
      where e.id = p_event_id and e.wedding_id = v_invite.wedding_id
    );
  end if;

  if not v_event_ok then
    raise exception 'event is not part of this invitation';
  end if;

  insert into public.guest_rsvps (guest_id, event_id, response, responded_at)
  values (
    p_guest_id,
    p_event_id,
    p_response,
    case when p_response = 'pending' then null else now() end
  )
  on conflict (guest_id, event_id) do update
    set response = excluded.response,
        responded_at = excluded.responded_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_guest_invitation_rsvp(text, uuid, uuid, text) from public;
grant execute on function public.submit_guest_invitation_rsvp(text, uuid, uuid, text) to anon, authenticated;
