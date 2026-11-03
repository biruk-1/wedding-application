-- Extend wedding onboarding to support multiple celebration kinds and atomically
-- create the celebration, owner membership, budget, and initial allocations.

alter table public.weddings
  add column if not exists celebration_kind text not null default 'wedding';

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.weddings'::regclass
      and conname = 'weddings_celebration_kind_check'
  ) then
    alter table public.weddings
      add constraint weddings_celebration_kind_check
      check (
        celebration_kind in (
          'wedding',
          'shemgelena',
          'qelekel',
          'baby_shower',
          'birthday',
          'anniversary',
          'graduation',
          'other'
        )
      );
  end if;
end;
$$;

alter table public.weddings
  alter column partner_one_name drop not null,
  alter column partner_two_name drop not null;

-- Drop the old identity signature before adding defaulted trailing parameters.
-- Keeping the original parameters in the same order preserves positional and
-- named-argument compatibility for existing callers.
drop function if exists public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer
);

drop function if exists public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
);

create function public.create_wedding(
  p_title text,
  p_partner_one_name text default null,
  p_partner_two_name text default null,
  p_wedding_date date default null,
  p_city text default null,
  p_country_code char(2) default 'ET',
  p_timezone text default 'Africa/Addis_Ababa',
  p_style text default null,
  p_currency_code char(3) default 'ETB',
  p_estimated_guest_count integer default null,
  p_celebration_kind text default 'wedding',
  p_total_budget numeric default 0,
  p_budget_allocations jsonb default '[]'::jsonb
)
returns public.weddings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wedding public.weddings;
  v_invalid_allocation boolean;
  v_allocation_total numeric;
begin
  if v_uid is null then
    raise exception 'authentication required';
  end if;

  if p_title is null or length(pg_catalog.btrim(p_title)) = 0 then
    raise exception 'title is required';
  end if;

  if p_celebration_kind is null or p_celebration_kind not in (
    'wedding',
    'shemgelena',
    'qelekel',
    'baby_shower',
    'birthday',
    'anniversary',
    'graduation',
    'other'
  ) then
    raise exception 'invalid celebration_kind';
  end if;

  if p_celebration_kind = 'wedding' and (
    p_partner_one_name is null
    or length(pg_catalog.btrim(p_partner_one_name)) = 0
    or p_partner_two_name is null
    or length(pg_catalog.btrim(p_partner_two_name)) = 0
  ) then
    raise exception 'partner names are required for weddings';
  end if;

  if p_total_budget is null or p_total_budget < 0 then
    raise exception 'total_budget must be nonnegative';
  end if;

  if p_estimated_guest_count is not null and p_estimated_guest_count < 0 then
    raise exception 'estimated_guest_count must be nonnegative';
  end if;

  if p_budget_allocations is null
    or pg_catalog.jsonb_typeof(p_budget_allocations) <> 'array' then
    raise exception 'budget_allocations must be an array';
  end if;

  select coalesce(
    pg_catalog.bool_or(
      pg_catalog.jsonb_typeof(allocation) <> 'object'
      or pg_catalog.jsonb_typeof(allocation -> 'category_slug') <> 'string'
      or length(pg_catalog.btrim(allocation ->> 'category_slug')) = 0
      or pg_catalog.jsonb_typeof(allocation -> 'amount') <> 'number'
      or (allocation ->> 'amount')::numeric < 0
    ),
    false
  )
  into v_invalid_allocation
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation);

  if v_invalid_allocation then
    raise exception 'each budget allocation requires a valid category_slug and nonnegative amount';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation)
    left join public.budget_categories category
      on category.slug = allocation ->> 'category_slug'
    where category.id is null
  ) then
    raise exception 'budget allocation contains an invalid category_slug';
  end if;

  select coalesce(pg_catalog.sum((allocation ->> 'amount')::numeric), 0)
  into v_allocation_total
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation);

  if v_allocation_total > p_total_budget then
    raise exception 'budget allocation total cannot exceed total_budget';
  end if;

  insert into public.profiles (id)
  values (v_uid)
  on conflict (id) do nothing;

  insert into public.weddings (
    created_by,
    title,
    partner_one_name,
    partner_two_name,
    wedding_date,
    city,
    country_code,
    timezone,
    style,
    currency_code,
    estimated_guest_count,
    celebration_kind
  ) values (
    v_uid,
    pg_catalog.btrim(p_title),
    nullif(pg_catalog.btrim(p_partner_one_name), ''),
    nullif(pg_catalog.btrim(p_partner_two_name), ''),
    p_wedding_date,
    nullif(pg_catalog.btrim(p_city), ''),
    coalesce(p_country_code, 'ET'),
    coalesce(p_timezone, 'Africa/Addis_Ababa'),
    p_style,
    coalesce(p_currency_code, 'ETB'),
    p_estimated_guest_count,
    p_celebration_kind
  )
  returning * into v_wedding;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (v_wedding.id, v_uid, 'owner');

  insert into public.wedding_budgets (wedding_id, total_budget, currency_code)
  values (v_wedding.id, p_total_budget, v_wedding.currency_code);

  insert into public.budget_items (
    wedding_id,
    category_id,
    label,
    estimated_amount
  )
  select
    v_wedding.id,
    category.id,
    category.name_en,
    (allocation ->> 'amount')::numeric
  from pg_catalog.jsonb_array_elements(p_budget_allocations) as item(allocation)
  join public.budget_categories category
    on category.slug = allocation ->> 'category_slug';

  return v_wedding;
end;
$$;

revoke all on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
) from public;

grant execute on function public.create_wedding(
  text, text, text, date, text, char, text, text, char, integer, text, numeric, jsonb
) to authenticated;
