# Wedding onboarding (Task 5)

Authenticated users create and open weddings through the approved `public.create_wedding` RPC.

## Flow

1. Sign in → `/(app)` hub loads memberships (RLS).
2. **0 weddings** → onboarding welcome → create flow.
3. **1 wedding** → redirect to `/(app)/weddings/[id]` dashboard.
4. **Many** → `/(app)/weddings` selector (plus create).

Create steps: Basics → Details → Review → RPC → success → dashboard.

## Database

- RPC: `create_wedding(...)` (SECURITY DEFINER) inserts wedding, **owner** membership, and empty `wedding_budgets` atomically.
- Clients must **not** insert into `weddings` / `wedding_members` directly (no insert policies).
- Reads use membership-scoped RLS (`private.is_wedding_member`).

Collected fields (schema-backed only):

| UI | Column / RPC arg |
| --- | --- |
| Title | `title` / `p_title` |
| Partner one / two | `partner_one_name`, `partner_two_name` |
| Date (optional) | `wedding_date` (`YYYY-MM-DD`) |
| City (optional) | `city` |
| Style (optional) | `style` (`traditional` \| `modern` \| `blend`) |

Defaults applied by RPC: `country_code=ET`, `timezone=Africa/Addis_Ababa`, `currency_code=ETB`.

## Local testing

```powershell
npm run db:start
npm test
npm start
```

Integration coverage in `weddingService.integration.test.ts` skips if Supabase is down.
