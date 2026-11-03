# Multi-event personalization (Shemgelena, Qelekel, Baby Shower, …)

**Status:** Implemented by `supabase/migrations/20261103180000_celebration_onboarding.sql`.

## Implemented model

`weddings.celebration_kind` identifies one of eight kinds:

- `wedding`
- `shemgelena`
- `qelekel`
- `baby_shower`
- `birthday`
- `anniversary`
- `graduation`
- `other`

The column is non-null with a `wedding` default and a database check constraint. Existing rows therefore remain weddings. The internal `weddings` table, `weddingId` route segments, membership helpers, and related wedding-named tables remain unchanged for backward compatibility.

`wedding_events.event_type` still describes a schedule item; it is not the celebration kind.

## Onboarding and atomic creation

The create flow now collects the celebration kind, event-aware title/date/location fields, style, total budget, and optional budget allocations. Partner columns are nullable in the table and omitted for non-wedding celebrations. Weddings still require both partner names in client validation and in the `create_wedding` RPC, so bypassing the client cannot weaken that rule.

The migrated `create_wedding` RPC creates the celebration row, owner membership, `wedding_budgets` total, and initial `budget_items` allocations in one transaction. Allocation category slugs must exist, amounts must be nonnegative, and their sum cannot exceed the total budget.

The original first ten RPC arguments retain their order and the new arguments have defaults. Existing named and positional callers remain compatible; callers that do not send `p_celebration_kind` create a wedding.

## Personalization

- Onboarding cards and non-wedding dashboard heroes use event-aware bundled imagery.
- Dashboard copy, title treatment, countdown accessibility labels, and related navigation copy use the celebration kind.
- Vendor recommendations use the existing `vendor_categories.slug` values. Ranking is stable and client-side: vendors matching an earlier preferred slug move first, while original order is preserved within equal ranks.
- “All Vendors” remains available and selecting a recommendation is only a normal category filter.
- Image sources and licenses are recorded in `assets/images/ATTRIBUTION.md`.

## Compatibility and limitations

- RLS and membership authorization remain wedding-scoped; no service-role key is exposed to the client.
- There is no database event-to-vendor-category join or new category taxonomy. Preferred slugs are application configuration, and configured categories missing from the database are ignored.
- Internal wedding table, RPC, type, service, and route names remain.
- The three existing styles (`traditional`, `modern`, `blend`) still apply to every celebration.
- Shemgelena and Qelekel reuse approved existing traditional/fusion imagery pending ceremony-specific licensed assets.
- Checklist data is shared with the existing checklist system. Event-specific checklist templates are not implemented.

## Verification evidence

- Typecheck passed.
- Lint completed with 0 errors and the known generated-file warning.
- Test suite passed: 34 files / 207 tests.
- Expo Doctor passed 20/20 checks.
- Security SQL passed.
- Browser verification covered the Baby Shower creation flow and budget, vendor, and dashboard checks.
