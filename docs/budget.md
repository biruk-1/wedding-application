# Wedding budget & expenses (Task 9)

Scoped to `/(app)/weddings/[weddingId]/budget`.

## Features

- Budget dashboard: total, allocated, actual, paid, outstanding, remaining, utilization
- Onboarding can set the total and allocate amounts across existing budget-category slugs
- Edit wedding budget total and currency (`wedding_budgets`)
- Category breakdown from seed `budget_categories` (planned vs actual)
- Expense CRUD (`budget_items`) with planned (`estimated_amount`) and optional actual (`committed_amount`)
- Payment tracking (`expense_payments`) with partial payments and derived paid/partial/unpaid status
- Optional link to a saved `wedding_vendors` row
- Skeleton loaders and TanStack Query caching (user-scoped keys)

## Financial definitions

| Metric | Formula |
| --- | --- |
| Total budget | `wedding_budgets.total_budget` |
| Allocated | sum of `budget_items.estimated_amount` |
| Actual | sum of `committed_amount` (null counts as 0) |
| Paid | sum of `expense_payments.amount` |
| Due (per item) | `committed_amount ?? estimated_amount` |
| Outstanding | sum of `max(0, due − paid)` per item |
| Remaining | total budget − actual |
| Utilization | actual ÷ total budget |

Category “over allocated” means category actual > category planned. There is **no** separate category-allocation table in the schema.

Money math uses integer cents (`src/features/budget/utils/money.ts`) to avoid float drift.

## Database

| Table | Usage |
| --- | --- |
| `wedding_budgets` | 1:1 with celebration; created with its total by `create_wedding`; clients UPDATE only |
| `budget_categories` | Seed lookup (read-only) |
| `budget_items` | Initial allocation lines plus later expenses / planned lines; RLS write for non-viewers |
| `expense_payments` | Payment history; amount must be > 0 |
| `wedding_vendors` | Optional expense link |

Payments that would exceed outstanding are rejected in the service layer (no DB payment-cap constraint).

`20261103180000_celebration_onboarding.sql` extends `create_wedding` so the celebration, owner membership, budget total, and initial allocation items are committed atomically. The RPC rejects unknown category slugs, negative values, and allocation totals above the overall budget. This applies to all eight celebration kinds; internal wedding table and route names remain for compatibility.

## Deferred

- Payment gateways (Stripe, Telebirr checkout, Chapa charge) — tracking methods only
- Currency conversion
- Receipt uploads (`receipt_storage_path` has no storage bucket)
- Auto-creating expenses from vendor inquiries or unconfirmed bookings
