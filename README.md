# Kiburan

Celebration planning + vendor marketplace app (Expo / React Native / TypeScript / Supabase). It supports weddings, Shemgelena, Qelekel, baby showers, birthdays, anniversaries, graduations, and other events while retaining internal wedding-named routes and tables for compatibility.

## Quick start

```powershell
npm install
# Start Docker Desktop, then:
npm run db:start
npm run db:status
# Copy EXPO_PUBLIC_SUPABASE_URL + ANON_KEY into .env (see .env.example)
npm start
```

## Documentation

| Doc | Topic |
| --- | --- |
| [docs/local-development.md](docs/local-development.md) | Local Supabase |
| [docs/authentication.md](docs/authentication.md) | Auth, email confirm, password reset |
| [docs/wedding-onboarding.md](docs/wedding-onboarding.md) | Wedding create / select / dashboard |
| [docs/event-types-proposal.md](docs/event-types-proposal.md) | Implemented multi-event model, compatibility & limitations |
| [docs/adaptive-wedding-themes.md](docs/adaptive-wedding-themes.md) | Style palettes & event-aware imagery |
| [docs/checklist.md](docs/checklist.md) | Checklist & task management |
| [docs/vendors.md](docs/vendors.md) | Vendor marketplace & inquiries |
| [docs/guests.md](docs/guests.md) | Guests, digital invitations, RSVPs, seating |
| [docs/guests.md](docs/guests.md) | Guests, invitations, RSVP & seating |
| [docs/budget.md](docs/budget.md) | Budget, expenses & payments |
| [docs/timeline.md](docs/timeline.md) | Events, wedding-day schedule & calendar |
| [docs/performance.md](docs/performance.md) | Caching, loading states, measurements |
| [docs/database-security.md](docs/database-security.md) | RLS / RPCs |
| [docs/design-tokens.md](docs/design-tokens.md) | UI tokens |
| [docs/ui-audit.md](docs/ui-audit.md) | UI audit vs reference |
| [docs/ui-refinement.md](docs/ui-refinement.md) | UI refinement milestone |
| [docs/documents-and-settings.md](docs/documents-and-settings.md) | Documents, profile & settings |
| [docs/notifications-proposal.md](docs/notifications-proposal.md) | Notification backend proposal |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest (validation + local Auth integration) |
| `npm run db:start` / `db:status` / `db:reset` | Local Supabase |
| `npm run db:test:security` | SQL RLS foundation tests |

## Auth routes

- `/` welcome → register / login  
- `/register`, `/login`, `/forgot-password`, `/reset-password`  
- `/(app)` signed-in celebration hub → selector / dashboard

## Current verification

- Typecheck passed.
- Lint: 0 errors; known generated-file warning only.
- Tests: 34 files / 207 tests passed.
- Expo Doctor: 20/20 checks passed.
- Security SQL passed.
- Browser checks covered Baby Shower onboarding plus budget, vendor, and dashboard behavior.
