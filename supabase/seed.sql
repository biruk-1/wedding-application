-- Idempotent reference data for local development.
-- English is required. Amharic (name_am / title_am) left null until verified translations exist.

-- Task categories
insert into public.task_categories (slug, name_en, name_am, icon, sort_order, is_active)
values
  ('venue', 'Venue', null, 'venue', 10, true),
  ('attire', 'Attire', null, 'attire', 20, true),
  ('photography', 'Photography', null, 'camera', 30, true),
  ('catering', 'Catering', null, 'food', 40, true),
  ('music', 'Music & entertainment', null, 'music', 50, true),
  ('flowers', 'Flowers & décor', null, 'flower', 60, true),
  ('invitations', 'Invitations', null, 'mail', 70, true),
  ('guests', 'Guests & seating', null, 'people', 80, true),
  ('budget', 'Budget', null, 'budget', 90, true),
  ('legal', 'Legal & documents', null, 'document', 100, true)
on conflict (slug) do update
set
  name_en = excluded.name_en,
  icon = excluded.icon,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

-- Checklist templates (keyed by category slug + title_en for idempotency)
insert into public.checklist_templates (
  category_id, title_en, title_am, description_en, description_am, suggested_days_before, sort_order, is_active
)
select c.id, t.title_en, null, t.description_en, null, t.suggested_days_before, t.sort_order, true
from public.task_categories c
join (
  values
    ('venue', 'Research venues', 'Shortlist venues that fit date, guest count, and style.', 270, 10),
    ('venue', 'Book the venue', 'Confirm deposit, contract, and rain plan if outdoor.', 240, 20),
    ('attire', 'Choose wedding attire', 'Select outfits for partners and key family members.', 180, 10),
    ('photography', 'Hire a photographer', 'Review portfolios and book preferred date.', 210, 10),
    ('catering', 'Confirm catering menu', 'Finalize menu, tasting, and guest dietary needs.', 120, 10),
    ('music', 'Book entertainment', 'DJ, band, or traditional performers.', 150, 10),
    ('flowers', 'Plan flowers and décor', 'Align décor with wedding style and venue rules.', 90, 10),
    ('invitations', 'Send invitations', 'Finalize guest list and send invitations.', 60, 10),
    ('guests', 'Collect RSVPs', 'Track responses and follow up with pending guests.', 30, 10),
    ('budget', 'Set total budget', 'Agree total budget and allocate by category.', 300, 10),
    ('legal', 'Gather required documents', 'Identify civil or religious paperwork deadlines.', 120, 10)
) as t(category_slug, title_en, description_en, suggested_days_before, sort_order)
  on c.slug = t.category_slug
where not exists (
  select 1
  from public.checklist_templates existing
  where existing.category_id = c.id
    and existing.title_en = t.title_en
);

-- Vendor categories
insert into public.vendor_categories (slug, name_en, name_am)
values
  ('photographer', 'Photographer', null),
  ('videographer', 'Videographer', null),
  ('florist', 'Florist', null),
  ('caterer', 'Caterer', null),
  ('venue', 'Venue', null),
  ('dj', 'DJ / music', null),
  ('makeup', 'Makeup & hair', null),
  ('planner', 'Wedding planner', null),
  ('cake', 'Cake & desserts', null),
  ('transport', 'Transport', null)
on conflict (slug) do update
set name_en = excluded.name_en;

-- ---------------------------------------------------------------------------
-- Local marketplace demo vendors (published + verified)
-- Requires an auth user as owner; runs as postgres so verification_status is allowed.
-- ---------------------------------------------------------------------------
do $$
declare
  v_owner uuid := '11111111-1111-4111-8111-111111111111';
  v_photographer uuid := '22222222-2222-4222-8222-222222222221';
  v_venue uuid := '22222222-2222-4222-8222-222222222222';
  v_caterer uuid := '22222222-2222-4222-8222-222222222223';
  v_florist uuid := '22222222-2222-4222-8222-222222222224';
  v_photo_svc uuid;
  v_venue_svc uuid;
  v_cater_svc uuid;
  v_flor_svc uuid;
  v_cat_photo uuid;
  v_cat_venue uuid;
  v_cat_cater uuid;
  v_cat_flor uuid;
begin
  if not exists (select 1 from auth.users where id = v_owner) then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_owner,
      'authenticated',
      'authenticated',
      'marketplace.seed@kiburan.local',
      crypt('SeedVendorPass1', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Marketplace Seed Owner"}'::jsonb,
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_owner,
      v_owner,
      format('{"sub":"%s","email":"marketplace.seed@kiburan.local"}', v_owner)::jsonb,
      'email',
      v_owner::text,
      now(),
      now(),
      now()
    )
    on conflict do nothing;
  end if;

  update public.profiles
  set display_name = 'Marketplace Seed Owner'
  where id = v_owner and coalesce(display_name, '') = '';

  select id into v_cat_photo from public.vendor_categories where slug = 'photographer';
  select id into v_cat_venue from public.vendor_categories where slug = 'venue';
  select id into v_cat_cater from public.vendor_categories where slug = 'caterer';
  select id into v_cat_flor from public.vendor_categories where slug = 'florist';

  insert into public.vendors (
    id, owner_user_id, business_name, slug, description, city, country_code,
    website_url, cover_url, listing_status, verification_status
  ) values
    (
      v_photographer, v_owner, 'Lumen & Lace Studio', 'lumen-lace-studio',
      'Documentary wedding photography with soft natural light and candid storytelling.',
      'Addis Ababa', 'ET', 'https://example.com/lumen-lace',
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      'published', 'verified'
    ),
    (
      v_venue, v_owner, 'Garden Court Venue', 'garden-court-venue',
      'Garden ceremony lawns and indoor reception halls for mid-size celebrations.',
      'Addis Ababa', 'ET', 'https://example.com/garden-court',
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
      'published', 'verified'
    ),
    (
      v_caterer, v_owner, 'Entreat Kitchen', 'entreat-kitchen',
      'Seasonal Ethiopian and continental menus with tasting sessions.',
      'Bahir Dar', 'ET', null,
      'https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&w=1200&q=80',
      'published', 'verified'
    ),
    (
      v_florist, v_owner, 'Petal & Stem', 'petal-stem',
      'Floral arches, table meadows, and bridal bouquets styled to your palette.',
      'Addis Ababa', 'ET', null,
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1200&q=80',
      'published', 'verified'
    )
  on conflict (slug) do update
  set
    description = excluded.description,
    city = excluded.city,
    cover_url = excluded.cover_url,
    listing_status = 'published',
    verification_status = 'verified';

  select id into v_photographer from public.vendors where slug = 'lumen-lace-studio';
  select id into v_venue from public.vendors where slug = 'garden-court-venue';
  select id into v_caterer from public.vendors where slug = 'entreat-kitchen';
  select id into v_florist from public.vendors where slug = 'petal-stem';

  insert into public.vendor_category_memberships (vendor_id, category_id)
  values
    (v_photographer, v_cat_photo),
    (v_venue, v_cat_venue),
    (v_caterer, v_cat_cater),
    (v_florist, v_cat_flor)
  on conflict do nothing;

  insert into public.vendor_team_members (vendor_id, user_id, role)
  values
    (v_photographer, v_owner, 'owner'),
    (v_venue, v_owner, 'owner'),
    (v_caterer, v_owner, 'owner'),
    (v_florist, v_owner, 'owner')
  on conflict do nothing;

  if not exists (select 1 from public.vendor_services where vendor_id = v_photographer) then
    insert into public.vendor_services (
      vendor_id, category_id, title, description, base_price, currency_code, price_unit, is_active
    ) values (
      v_photographer, v_cat_photo,
      'Full-day photography', 'Ceremony through reception coverage with edited gallery.',
      45000, 'ETB', 'package', true
    ) returning id into v_photo_svc;

    insert into public.vendor_packages (service_id, name, description, inclusions, price, currency_code, is_active)
    values
      (
        v_photo_svc, 'Signature day', 'Lead photographer + second shooter',
        '["8 hours coverage","Online gallery","50 print-ready favorites"]'::jsonb,
        45000, 'ETB', true
      ),
      (
        v_photo_svc, 'Highlight film add-on', 'Short cinematic edit',
        '["3–5 minute film"]'::jsonb,
        18000, 'ETB', true
      );
  end if;

  if not exists (select 1 from public.vendor_services where vendor_id = v_venue) then
    insert into public.vendor_services (
      vendor_id, category_id, title, description, base_price, currency_code, price_unit, is_active
    ) values (
      v_venue, v_cat_venue,
      'Garden reception rental', 'Venue hire including basic tables and ceremony lawn.',
      120000, 'ETB', 'day', true
    ) returning id into v_venue_svc;

    insert into public.vendor_packages (service_id, name, description, inclusions, price, currency_code, is_active)
    values (
      v_venue_svc, 'Weekend package', 'Friday setup through Sunday strike',
      '["Ceremony lawn","Reception hall","Bridal suite"]'::jsonb,
      150000, 'ETB', true
    );
  end if;

  if not exists (select 1 from public.vendor_services where vendor_id = v_caterer) then
    insert into public.vendor_services (
      vendor_id, category_id, title, description, base_price, currency_code, price_unit, is_active
    ) values (
      v_caterer, v_cat_cater,
      'Seated dinner', 'Plated dinner with service staff.',
      850, 'ETB', 'person', true
    ) returning id into v_cater_svc;

    insert into public.vendor_packages (service_id, name, description, inclusions, price, currency_code, is_active)
    values (
      v_cater_svc, 'Classic banquet', 'Three courses + soft drinks',
      '["Starter","Main","Dessert","Service team"]'::jsonb,
      950, 'ETB', true
    );
  end if;

  if not exists (select 1 from public.vendor_services where vendor_id = v_florist) then
    insert into public.vendor_services (
      vendor_id, category_id, title, description, base_price, currency_code, price_unit, is_active
    ) values (
      v_florist, v_cat_flor,
      'Ceremony florals', 'Arch, aisle markers, and bridal bouquet.',
      28000, 'ETB', 'package', true
    ) returning id into v_flor_svc;

    insert into public.vendor_packages (service_id, name, description, inclusions, price, currency_code, is_active)
    values (
      v_flor_svc, 'Garden meadow', 'Soft seasonal stems for ceremony and head table',
      '["Arch","Bouquet","4 centerpieces"]'::jsonb,
      32000, 'ETB', true
    );
  end if;

  insert into public.vendor_media (vendor_id, storage_path, media_type, caption, sort_order)
  select v_photographer,
    'https://images.unsplash.com/photo-1606800052052-a08af7148866?auto=format&fit=crop&w=900&q=80',
    'image', 'Portrait session', 1
  where not exists (
    select 1 from public.vendor_media m where m.vendor_id = v_photographer
  );

  insert into public.vendor_availability (
    vendor_id, starts_at, ends_at, status, notes
  )
  select
    v_photographer,
    (current_date + 45)::timestamptz + interval '10 hours',
    (current_date + 45)::timestamptz + interval '20 hours',
    'available',
    'Demo availability window for local testing'
  where not exists (
    select 1 from public.vendor_availability a where a.vendor_id = v_photographer
  );
end $$;

-- Budget categories
insert into public.budget_categories (slug, name_en, name_am)
values
  ('venue', 'Venue', null),
  ('food', 'Food & drink', null),
  ('attire', 'Attire', null),
  ('photography', 'Photography & video', null),
  ('flowers', 'Flowers & décor', null),
  ('entertainment', 'Entertainment', null),
  ('invitations', 'Invitations & stationery', null),
  ('transport', 'Transport', null),
  ('gifts', 'Gifts & favors', null),
  ('contingency', 'Contingency', null)
on conflict (slug) do update
set name_en = excluded.name_en;
