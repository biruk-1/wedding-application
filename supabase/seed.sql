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
