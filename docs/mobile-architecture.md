# Mobile architecture proposal

Status: proposal only. No features are implemented and no dependencies have been added.

## Current baseline

- Expo SDK 58, React Native 0.88, React 19.3, TypeScript 6 (`strict`), Expo Router 58 with typed routes and the React Compiler enabled (`app.json` → `experiments`).
- Routes live in the top-level `app/` directory. Non-route code lives in `src/`. The path alias is `@/*` → `src/*`, plus `@/assets/*` → `assets/*`.
- Starter template code still present: the Home/Explore screens, `animated-icon`, `hint-row`, `web-badge`, `external-link`, `collapsible`, `themed-text`/`themed-view`, the theme tokens, `scripts/reset-project.js`, and the demo images. Replace these as each feature lands, not all at once.

## Route map (Expo Router)

Tab names follow the approved reference: Home, Tasks, Vendors, Guests, More.

```
app/
├── _layout.tsx                 # Root stack: fonts, theme, auth/session gate, query client
├── (auth)/                     # Welcome ("Plan Together, Celebrate Forever"), sign in, sign up
├── (onboarding)/
│   └── create-wedding/         # 3 steps: Basics → Date & Venue → Details (style)
├── (tabs)/
│   ├── _layout.tsx             # Home · Tasks · Vendors · Guests · More
│   ├── index.tsx               # Dashboard
│   ├── tasks.tsx               # Checklist categories
│   ├── vendors.tsx             # Vendor marketplace list
│   ├── guests.tsx              # Guest list
│   └── more.tsx                # Budget, Schedule, Invitations, Settings
├── tasks/[categoryId].tsx
├── vendors/[vendorId].tsx
├── guests/[guestId].tsx
├── budget/index.tsx
├── schedule/index.tsx
└── invitations/index.tsx
```

Route files stay thin. They read params and render a screen component from the matching feature folder.

## Source layout

```
src/
├── features/
│   ├── auth/            # session hook, sign-in screens
│   ├── onboarding/      # create-wedding wizard → create_wedding RPC
│   ├── dashboard/       # countdown, progress, quick tiles, upcoming tasks
│   ├── tasks/           # wedding_tasks, task_categories, checklist_templates
│   ├── vendors/         # vendors, services, packages, wedding_vendors, inquiries
│   ├── guests/          # guests, guest_groups, guest_rsvps, seating
│   ├── invitations/     # invitations, invitation_events, invitation_designs
│   ├── budget/          # wedding_budgets, budget_items, expense_payments
│   └── schedule/        # wedding_events, timeline_items
├── components/
│   ├── ui/              # Button, Card, Chip/FilterTabs, Avatar, ProgressBar, ListRow, TextField, Badge
│   └── layout/          # Screen, Header, TabBar, Section
├── theme/               # tokens: colors, typography, spacing, radii, shadows
├── lib/
│   └── supabase/        # client, auth storage adapter, RPC wrappers
├── types/
│   └── database.ts      # generated from the approved schema (supabase gen types)
└── utils/               # dates/countdown, currency formatting (ETB), i18n helpers
```

Each feature folder follows the same internal shape: `api.ts` (queries/mutations), `hooks.ts`, `components/`, `screens/`, and `types.ts`. Features import shared UI and `lib`, but never import from each other's internals. Anything two features both need moves up to `components/` or `utils/`.

## Theme and design tokens

From the approved reference: warm ivory background, champagne gold primary (CTAs, active chips), forest green for success/progress and the Save action, a soft red for destructive actions and high priority, rounded cards (~16px), pill chips, and a serif display face for headings with a clean sans for body text.

- Replace the template `Colors`/`Spacing` in `src/theme/index.ts` with semantic tokens (`surface`, `surfaceElevated`, `primary`, `success`, `danger`, `textMuted`, ...). Screens use the semantic tokens, never raw hex values.
- Fonts go in `assets/fonts/` and load through `expo-font` (already installed).
- Light theme first. The reference doesn't define a dark theme, so dark mode is an open design question.

## Supabase integration

- `@supabase/supabase-js` is **not** installed yet. Add it with `npx expo install` when the first backend task is approved.
- Session storage: `expo-secure-store` (small values) or AsyncStorage. Decide when auth is built.
- All multi-table writes go through RPCs, not chained client inserts. The required RPCs are listed in `docs/schema-audit.md` section 7.
- Regenerate `src/types/database.ts` from the approved schema. Never hand-write table types.
- Environment: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`.env.example`). The service role key never ships in the app.

## Dependencies to decide later (not installed)

| Need | Candidate | Decide when |
| --- | --- | --- |
| Backend client | `@supabase/supabase-js` | First Supabase task |
| Server-state caching | `@tanstack/react-query` | First data screen |
| Forms/validation | `react-hook-form` + `zod` | Onboarding wizard |
| i18n (en/am) | `expo-localization` + a small i18n lib | Before the first user-facing copy freeze |
