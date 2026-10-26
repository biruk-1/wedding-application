# Local development (Supabase)

## Prerequisites

1. **Docker Desktop** running (Linux engine). `docker ps` must succeed. If you see `Docker Desktop is unable to start` / HTTP 503 on `_ping`, open Docker Desktop and fix the engine/WSL2 backend before continuing.
2. **Node.js 20+** (project currently uses the Expo toolchain).
3. Dev dependency `supabase` (+ `@supabase/cli-windows-x64` on Windows).

### Windows Application Control note

`npx supabase` may fail with `spawn UNKNOWN` because Application Control blocks binaries under `node_modules`. This repo’s launcher copies the CLI to `%LOCALAPPDATA%\kiburan\bin\supabase.exe` and runs that copy instead:

```powershell
npm run supabase -- --version
```

If that still fails, allowlist the binary or install via Scoop and set `SUPABASE_CLI_BINARY_OVERRIDE`.
## First-time setup

```powershell
cd kiburan
npm install
# Start Docker Desktop, wait until docker ps works
npm run db:start
```

On first start the CLI downloads images. When ready it prints local URLs and keys.

Copy **publishable / anon** values into `.env` for the mobile app later (not required for this database task):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
```

Never put the **service_role / secret** key in the Expo app.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run db:start` | Start local stack |
| `npm run db:stop` | Stop stack (keeps data) |
| `npm run db:status` | URLs and keys |
| `npm run db:reset` | Recreate DB from migrations + seed |
| `npm run db:types` | Generate `src/types/database.types.ts` |
| `npm run db:test:security` | Run `supabase/tests/security_foundation.sql` via `psql` |

Reset equivalent:

```powershell
npm run supabase -- db reset
```

## Applying migrations

Migrations live in `supabase/migrations/` and apply automatically on `db:start` / `db:reset`.

Do **not** edit `reference/kiburan_schema.sql`. Add a new timestamped migration instead.

## Seed data

`supabase/seed.sql` loads after migrations when `[db.seed]` is enabled in `config.toml`. It is idempotent (`on conflict` / `where not exists`).

## Studio

Default: [http://127.0.0.1:54323](http://127.0.0.1:54323)

## Database URL (psql)

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Authentication

See [authentication.md](./authentication.md) for Expo env vars, email confirmation, password-reset redirects, and how to test Auth locally.

## Hosted projects

This task does **not** link or push to a hosted Supabase project. Do not run `supabase db push` / `supabase link` until a later deployment task.

