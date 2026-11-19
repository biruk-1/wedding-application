-- Passwordless invite gate: prove email matches a pending invite before Auth OTP is sent.
-- Does not accept the invite and does not reveal whether the email already has an account.

create or replace function public.validate_team_invite_email(
  p_raw_token text,
  p_email text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_invite public.wedding_invites;
  v_email text := nullif(lower(btrim(p_email)), '');
  v_title text;
  v_inviter text;
begin
  if p_raw_token is null or length(btrim(p_raw_token)) = 0 then
    raise exception 'token is required';
  end if;
  if v_email is null or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'enter a valid email address';
  end if;

  v_hash := encode(extensions.digest(convert_to(btrim(p_raw_token), 'UTF8'), 'sha256'), 'hex');

  select * into v_invite
  from public.wedding_invites i
  where i.token_hash = v_hash;

  if not found then
    raise exception 'invalid invite token';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'invite has been revoked';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'invite has already been used';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite has expired';
  end if;
  if v_invite.invited_email is null then
    raise exception 'this invite cannot be accepted until phone sign-in is available';
  end if;
  if v_email is distinct from lower(btrim(v_invite.invited_email)) then
    raise exception 'this invite was sent to a different email address';
  end if;

  select w.title into v_title from public.weddings w where w.id = v_invite.wedding_id;
  select coalesce(nullif(p.display_name, ''), 'Someone') into v_inviter
  from public.profiles p
  where p.id = v_invite.invited_by;

  return jsonb_build_object(
    'ok', true,
    'invite_id', v_invite.id,
    'wedding_id', v_invite.wedding_id,
    'wedding_title', coalesce(v_title, 'A celebration'),
    'inviter_name', coalesce(v_inviter, 'Someone'),
    'role', v_invite.role,
    'invite_kind', v_invite.invite_kind,
    'expires_at', v_invite.expires_at
  );
end;
$$;

comment on function public.validate_team_invite_email(text, text) is
  'Confirms a pending team invite token is bound to the given email before passwordless OTP.';

revoke all on function public.validate_team_invite_email(text, text) from public;
grant execute on function public.validate_team_invite_email(text, text) to anon, authenticated, service_role;
