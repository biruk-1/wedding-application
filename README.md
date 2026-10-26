# Kiburan

Wedding planning + vendor marketplace app (Expo / React Native / TypeScript / Supabase).

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
| [docs/database-security.md](docs/database-security.md) | RLS / RPCs |
| [docs/design-tokens.md](docs/design-tokens.md) | UI tokens |

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
- `/(app)` signed-in home (sign out) — wedding dashboard comes later  
