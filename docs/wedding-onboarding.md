# Celebration onboarding (Task 5)

Authenticated users create and open celebrations through the approved `public.create_wedding` RPC. Internal table, RPC, service, and route names remain wedding-based for compatibility.

## Flow

1. Sign in → `/(app)` hub loads memberships (RLS).
2. **0 weddings** → onboarding welcome → create flow.
3. **1 wedding** → redirect to `/(app)/weddings/[id]` dashboard.
4. **Many** → `/(app)/weddings` selector (plus create).

Create steps: Celebration → Details → Style → Budget → Review → RPC → success → dashboard.

## Database

- Migration: `20261103180000_celebration_onboarding.sql`.
- RPC: `create_wedding(...)` (SECURITY DEFINER) inserts the celebration, **owner** membership, `wedding_budgets` total, and initial `budget_items` allocations atomically.
- Clients must **not** insert into `weddings` / `wedding_members` directly (no insert policies).
- Reads use membership-scoped RLS (`private.is_wedding_member`).

Supported kinds: `wedding`, `shemgelena`, `qelekel`, `baby_shower`, `birthday`, `anniversary`, `graduation`, and `other`.

Collected fields (schema-backed only):

| UI | Column / RPC arg |
| --- | --- |
| Celebration kind | `celebration_kind` / `p_celebration_kind` |
| Title | `title` / `p_title` |
| Partner one / two | `partner_one_name`, `partner_two_name` (wedding only) |
| Date (optional) | `wedding_date` (`YYYY-MM-DD`) |
| City (optional) | `city` |
| Style (optional) | `style` (`traditional` \| `modern` \| `blend`) |
| Guest count (optional) | `estimated_guest_count` |
| Total budget | `p_total_budget` → `wedding_budgets.total_budget` |
| Category allocations | `p_budget_allocations` → `budget_items` |

Defaults applied by RPC: `country_code=ET`, `timezone=Africa/Addis_Ababa`, `currency_code=ETB`.

Partner columns are nullable so non-wedding events do not need fake partner data. Both the client schema and RPC require two nonblank partner names when `celebration_kind = 'wedding'`.

Existing rows and callers are compatible: the new kind defaults to `wedding`, the original RPC argument order is retained, and new arguments have defaults.

The UI uses celebration-aware labels and imagery, including the dashboard hero. Image licensing details live in `assets/images/ATTRIBUTION.md`. Shemgelena and Qelekel currently reuse the approved traditional/fusion images pending ceremony-specific licensed assets.

## Limitations

- Internal `weddings` and `weddingId` naming remains.
- Event-specific checklist templates are not implemented.

## Local testing

```powershell
npm run db:start
npm test
npm start
```

Integration coverage in `weddingService.integration.test.ts` skips if Supabase is down.

Current broader verification: typecheck passed; lint reported 0 errors with the known generated-file warning; 34 files / 207 tests passed; Expo Doctor passed 20/20; security SQL passed; and browser checks covered the Baby Shower flow plus budget, vendor, and dashboard behavior.
