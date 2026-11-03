# Performance

How Kiburan loads, caches and refreshes data, and how to measure it.

## Data layer

Server state is owned by TanStack Query (`src/lib/query`). Screens call feature hooks
(`src/features/*/queries.ts`); the hooks call the existing services, which still return
`ServiceResult` and are unwrapped into `QueryError` for the cache.

### Cache keys and isolation

Every key starts with `['u', userId, ...]` (`queryKeys.ts`), including reference data, so one
account can never read another account's entries. In addition `syncCacheOwner` cancels in-flight
queries and clears the whole cache whenever the signed-in user changes or signs out. The query
cache is **not persisted** to storage; only the Supabase session is, by supabase-js itself.

Cached data never replaces authorization: every request still goes through RLS, and a wedding
the user cannot access returns no rows rather than a cached copy.

### Expirations

| Data | `staleTime` | Notes |
| --- | --- | --- |
| Task categories, template count, vendor categories, cities | 60 min | Seed/migration data |
| Vendor listings and profiles | 5 min | Public, rarely edited |
| Wedding, memberships | 60 s | |
| Tasks, comments, members (default) | 30 s | Partners edit concurrently |

Unused entries are garbage-collected after 30 minutes. Queries refetch on focus and reconnect
once stale; fresh data is shown immediately while revalidating in the background.

### Network policy

- Every Supabase request uses `fetchWithTimeout` (15 s) and honours React Query's abort signal,
  so leaving a screen or changing filters cancels the old request.
- Only `network` and `timeout` errors are retried (max 2, exponential back-off 1 s → 8 s).
  RLS, validation and not-found errors fail immediately. Mutations are never retried.
- Mutations only report success after the server confirms the write. Removing a saved vendor
  that affects zero rows returns `not_removed` instead of a false success.
- Optimistic updates are limited to task status toggles and roll back per task on failure.

## Loading states

Skeletons (`src/components/skeletons`) appear **only** when a screen has no cached data:
dashboard/home, wedding list, checklist, task detail, task form, marketplace, vendor profile and
inquiry form. When cached data exists it is rendered immediately and a background refresh shows
an inline indicator or a `RefreshNotice` if it fails. There are no artificial delays.

## Query shape

- Login → dashboard: memberships are prefetched as soon as Supabase confirms the session; the
  wedding is read from the memberships embed, then revalidated.
- Checklist: tasks (with category and assignees embedded), categories and template count load
  in one parallel round. Task detail is seeded from the list cache.
- Marketplace: search, category, city and price filters run on the server with paging
  (20 per page). Search also matches category names via a membership lookup.
- Vendor profile: four parallel requests (vendor with services/packages embedded, media,
  upcoming availability capped at 12, reviews capped at 20).

### Index candidates (not applied)

No migration was added because there is no query-plan evidence yet. Candidates to validate with
`EXPLAIN ANALYZE` on realistic data, via a new reviewed migration (never by editing
`kiburan_schema.sql`): `task_comments(task_id)`, `vendor_media(vendor_id)`,
`vendor_packages(service_id)`, and the existing `idx_vendor_search` for `ilike` search.

## Measuring

```bash
npm run db:start
node scripts/perf/measure-data-flows.mjs 15   # runs per flow, default 5
```

The script signs in local test users and times the legacy and current query sequences for each
flow (median over N runs, request count, round trips, body size). Numbers are localhost only and
do not include rendering or mobile latency.

In development builds the app logs `[perf]` marks (`auth:restore`, `dashboard:first-usable`)
from `src/lib/perf.ts`; use these on a device for cold/warm start timings.
