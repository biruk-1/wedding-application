# Planning Team — 01. Repository audit

| | |
| --- | --- |
| Milestone | 1 (audit only, no feature code) |
| Audit date | 2026-11-05 |
| Repository root | `kiburan/` (its own git repository, nested inside a Desktop-level repository) |
| HEAD | `88bb0e8` ("added some new tradiotnal and modern options") |
| Working tree | **Dirty.** Many uncommitted UI/theme edits (guests routes, layouts, `WeddingTabBar`, `Header`, `Screen`, deleted style images). None were touched by this audit. Commit or stash them before Milestone 2 so migration work is reviewable in isolation. `supabase/migrations/20261103180000_celebration_onboarding.sql` shows as modified but the diff is line endings only (no SQL change); `20261105210000_wedding_covers_storage.sql` is untracked but already applied locally. |

Everything below was read from the code, not inferred from earlier docs.

---

## 1. Project structure

```
kiburan/
  app/                         Expo Router routes (screens only, thin wrappers)
    _layout.tsx                Root Stack + QueryClientProvider + AuthProvider + WeddingThemeProvider
    index.tsx, login.tsx, register.tsx, forgot-password.tsx, reset-password.tsx
    invite/[token].tsx         PUBLIC guest RSVP page (wedding guests, NOT team invites)
    (app)/_layout.tsx          Signed-in Stack
    (app)/index.tsx            AppHomeHubScreen
    (app)/create-wedding.tsx
    (app)/weddings/index.tsx   WeddingSelectorScreen (workspace switcher)
    (app)/weddings/[weddingId]/...  index, checklist, vendors, guests, budget, timeline,
                                    documents, settings, more, success
    (tabs)/                    Legacy Expo template routes (unused by the auth gate)
  src/
    components/                Shared UI (ui/, layout/, navigation/WeddingTabBar, skeletons/, theme/)
    features/<feature>/        auth, budget, checklist, documents, guests, settings, timeline,
                               vendors, weddings
    lib/                       supabase.ts, authStorage.ts, query/ (client, keys, cacheOwner, errors)
    theme/                     Adaptive Ethiopian theme system (palettes, WeddingThemeContext)
    types/database.types.ts    Generated Supabase types
  supabase/
    config.toml, seed.sql
    migrations/                8 migrations (listed in section 9)
    tests/security_foundation.sql
  reference/kiburan_schema.sql PM-provided original schema (unchanged)
  scripts/                     supabase.mjs, gen-db-types.mjs, run-security-tests.mjs, qa/, perf/, theme/
  docs/                        21 existing design/security docs + this planning-team folder
```

### Feature module convention (confirmed in every feature folder)

```
src/features/<feature>/
  services/   <feature>Service.ts (Supabase calls, return { ok, data } | { ok:false, error })
              <feature>Selects.ts (explicit column lists, never `*`)
              <feature>Errors.ts  (maps Postgres/PostgREST errors to user messages)
              *.integration.test.ts (run against local Supabase)
  queries.ts  TanStack Query hooks (useQuery/useMutation wrappers)
  screens/    Screen components (routes in app/ import these)
  components/ Feature-specific components
  validation/ zod schemas + tests
  types.ts, utils/
```

The Planning Team feature should follow this exact layout as `src/features/team/`.

---

## 2. Package configuration (`package.json`)

| Area | Version |
| --- | --- |
| Expo SDK | `expo ~58.0.23`, `expo-router ~58.0.30` |
| React / React Native | `react 19.3.0`, `react-native 0.88.1` |
| Supabase | `@supabase/supabase-js ^2.118.0`; CLI `supabase ^2.122.0` (dev) |
| Data | `@tanstack/react-query ^5.105.0`, `zod ^4.6.7` |
| Storage | `@react-native-async-storage/async-storage 2.2.0` |
| Tests | `vitest ^5.0.5` |
| TypeScript | `~6.0.3` |

Scripts: `lint`, `test` (vitest), `typecheck` (`tsc --noEmit`), `db:start|stop|reset|status` (wrap the Supabase CLI via `scripts/supabase.mjs`), `db:types` (regenerate `database.types.ts`), `db:test:security` (runs `supabase/tests/security_foundation.sql` via `psql`).

No new dependency is needed for the Planning Team feature (secure tokens, hashing, and permission checks all live in Postgres).

## 3. TypeScript configuration (`tsconfig.json`)

Extends `expo/tsconfig.base`, `strict: true`, path aliases `@/*` → `src/*` and `@/assets/*` → `assets/*`.

## 4. Expo Router configuration (`app.json`, layouts)

- `scheme: "kiburan"` (deep links: `kiburan://...`), `experiments.typedRoutes: true`, `experiments.reactCompiler: true`, web `output: "static"`.
- Root `app/_layout.tsx` declares: `index`, `login`, `register`, `forgot-password`, `reset-password`, `invite/[token]`, `(app)`, `(tabs)`.
- `app/(app)/_layout.tsx` is a Stack; wedding "tabs" are peer routes switched with `router.replace` by `src/components/navigation/WeddingTabBar.tsx` (Home, Tasks, Vendors, Guests, More).
- The **active workspace is the `weddingId` URL segment**. There is no global "current wedding" store. `WeddingThemeContext` reads `weddingId` from route params/segments to pick the theme.

## 5. Authentication implementation

| File | Role |
| --- | --- |
| `src/lib/supabase.ts` | Single anon-key client (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), PKCE flow, `authStorage` persistence, fetch timeout. Comment: "Never ship the service-role key in the app." |
| `src/lib/authStorage.ts` | Session storage adapter |
| `src/features/auth/services/authService.ts` | `signUp` (email + password, `display_name` metadata), `signIn`, `signOut`, `requestPasswordReset` (enumeration-safe), `updatePassword`, `handleAuthCallbackUrl` (PKCE code or implicit tokens) |
| `src/features/auth/context/AuthContext.tsx` | Session state, `onAuthStateChange`, deep-link handling, cache owner switching, prefetches memberships |
| `src/features/auth/hooks/useAuthGate.ts` + `navigation/resolveAuthRedirect.ts` | Pure redirect policy: signed-out users in `(app)`/`(tabs)` → `/`; signed-in users on `index/login/register/forgot-password` → `/(app)`. Any other root (e.g. `invite`, `reset-password`) is left alone. |

Email/password only. No phone/OTP sign-in. Local `supabase/config.toml` has `enable_confirmations = false` (sign-up yields a session immediately).

**Gap relevant to invitations:** after login/registration the gate always sends the user to `/(app)`. There is no "return to" mechanism, so a team-invite link opened while signed out would be lost after sign-in. See `07-application-integration-plan.md`.

## 6. Supabase client and service-role usage

- Only the anon key is used in app code. `rg service_role` over `src/`, `app/`, `scripts/` returns nothing.
- `.env.example` documents `SUPABASE_SERVICE_ROLE_KEY` as "scripts / CI only — never ship".
- Integration tests also use the anon key and sign in as real local users.

## 7. Shared types

- `src/types/database.types.ts` is generated (`npm run db:types`). It includes `celebration_kind` and all 8 RPCs.
- `WeddingMemberRole` in `src/features/weddings/types.ts` is derived from the generated `wedding_members.role` type, so any role-value change must be followed by type regeneration.

## 8. State management, hooks and services relevant to Planning Team

| Concern | Location | Notes |
| --- | --- | --- |
| Query client | `src/lib/query/queryClient.ts` | TanStack Query |
| Query keys | `src/lib/query/queryKeys.ts` | Every key starts with `['u', userId, ...]`. A `weddingMembers` key already exists but is unused by a dedicated team feature. |
| Account isolation | `src/lib/query/cacheOwner.ts` | Clears all cached queries when the signed-in account changes. Good foundation for multi-user devices. |
| Memberships | `src/features/weddings/membershipsQuery.ts`, `services/weddingService.ts#listMyWeddings` | Reads `wedding_members` filtered by `user_id` with embedded `weddings`. Supports multiple weddings per user today. |
| Role in UI | `src/features/weddings/queries.ts#useWeddingRole` | Returns `{ role, canWrite: role !== 'viewer' }`. Used by ~25 screens to hide controls. Comment correctly states RLS is the real enforcement. |
| Duplicated role checks | `src/features/checklist/screens/TaskDetailScreen.tsx` (queries `wedding_members` directly), `src/features/vendors/services/vendorService.ts#canWriteWedding` | Two places bypass `useWeddingRole`; both must move to the new access hook. |
| Assignee picker | `src/features/checklist/services/checklistService.ts#listWeddingMembersForAssign` | Lists all members + display names. |
| Task assignment | `checklistService.ts#replaceAssignees` | Delete-all-then-insert, two requests, **not atomic**. |
| Guest group delete | `guestService.ts#deleteGuestGroup`, `#deleteGuest` | Delete dependent invitations then the row, two requests, not atomic. |
| Theme / workspace | `src/theme/WeddingThemeContext.tsx` | Resolves style from route `weddingId` + memberships, caches in AsyncStorage per user. |

**Client code that does not exist yet:** nothing in `src/` or `app/` calls `create_wedding_invite`, `accept_wedding_invite`, `set_wedding_member_role`, or reads `wedding_invites`. The collaborator backend exists but has no UI and no service layer.

## 9. Database files

| File | Content |
| --- | --- |
| `reference/kiburan_schema.sql` | PM original. SHA-256 `B1D81E00…A2C594` (verified today, unchanged). |
| `20260325120000_pm_baseline.sql` | Byte-identical copy of the reference after a 3-line header (verified with a line diff: 0 differences). |
| `20260325120100_security_helpers_triggers.sql` | `private` schema, `updated_at` triggers, `handle_new_user`, membership helpers, cross-wedding triggers, RLS indexes |
| `20260325120200_authorized_rpcs.sql` | `create_wedding` (v1), `create_wedding_invite`, `accept_wedding_invite`, `set_wedding_member_role` |
| `20260325120300_rls_policies.sql` | Enables RLS on all public tables; all policies; token-hash column revokes |
| `20260330120000_guest_invitation_rpcs.sql` | Guest invitation RPCs (create, mark sent, public preview, public RSVP) |
| `20260401120000_storage_and_file_update.sql` | `wedding-documents` (private) and `avatars` (public) buckets + policies |
| `20261103180000_celebration_onboarding.sql` | `celebration_kind`, nullable partner names, `create_wedding` v2 |
| `20261105210000_wedding_covers_storage.sql` | `wedding-covers` (public) bucket + policies |
| `supabase/seed.sql` | Lookup data |
| `supabase/tests/security_foundation.sql` | SQL security assertions (see weaknesses in `04-rls-and-security-audit.md`) |

All 8 migrations are recorded in `supabase_migrations.schema_migrations` on the running local stack.

## 10. Environment configuration

- `.env.example`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`; service-role key commented out and marked scripts-only.
- `supabase/config.toml`: project `kiburan`, API on 54321, DB on 54322 (Postgres 15), `max_rows = 1000`, auth `site_url = kiburan://`, redirect URLs for `kiburan://**` and Expo dev URLs, signup enabled, email confirmations disabled locally.
- `supabase status` reports `linked_project: null`. **No remote/production project is linked, so only the local database was inspected.**

## 11. Existing tests

- Unit tests (vitest, `src/**/*.test.ts`): validation schemas, helpers, cache ops, auth redirect policy, query policy, theme cache.
- Integration tests (`*.integration.test.ts`): auth, budget, checklist, guests, timeline, vendors, weddings, run against local Supabase with the anon key.
- SQL security suite: `supabase/tests/security_foundation.sql` (single owner, viewer, outsider; no multi-owner, no collaborator-permission, no financial-privacy, no group-isolation coverage).

## 12. Existing documentation worth keeping in sync

`docs/schema-audit.md` (detailed PM-schema audit; still accurate), `docs/database-security.md` (provisional role matrix; its claim that token hashes are not selectable is **incorrect**, see doc 04), `docs/authentication.md`, `docs/guests.md`, `docs/budget.md`, `docs/mobile-architecture.md`, `docs/notifications-proposal.md`.
