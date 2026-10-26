# Authentication (Task 4)

Kiburan uses **Supabase Auth** (email/password) with the Expo app’s anon key only. Profile rows are created by the existing `private.handle_new_user` trigger — the app must not insert into `profiles` itself.

## Environment variables

Copy `.env.example` → `.env` after starting local Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key from npm run db:status>
```

Never put `SERVICE_ROLE_KEY` / `SECRET_KEY` in the mobile app or commit `.env`.

## Start local stack + app

```powershell
# Docker Desktop must be running
npm run db:start
npm run db:status   # copy anon key into .env
npm start           # Expo
```

Mailpit (local emails): [http://127.0.0.1:54324](http://127.0.0.1:54324)

## Email confirmation

Local default in `supabase/config.toml`:

```toml
[auth.email]
enable_confirmations = false
```

With confirmations **off**, `signUp` returns a session immediately and navigation goes to `/(app)`.

To exercise the pending-verification path:

1. Set `enable_confirmations = true`.
2. Restart the stack (`npm run db:stop` then `npm run db:start`).
3. Register — the UI shows “check your email” and does **not** treat the user as signed in until they confirm.
4. Open the confirmation link from Mailpit.

## Password reset redirects

App scheme: `kiburan` (`app.json`).

Reset emails use `Linking.createURL('reset-password')`, typically:

- Native: `kiburan://reset-password`
- Expo Go / dev: `exp://127.0.0.1:8081/--/reset-password`
- Web: `http://localhost:8081/reset-password`

`supabase/config.toml` `[auth].additional_redirect_urls` must include those patterns. After changing `config.toml`, restart Supabase.

### Hosted Supabase (manual, later)

In the dashboard → **Authentication → URL configuration**:

1. Site URL = your production deep link / web origin.
2. Redirect URLs = `kiburan://reset-password`, any Expo/web URLs you use.
3. Enable or disable email confirmations to match product policy.

## Session persistence

`src/lib/supabase.ts` uses `@react-native-async-storage/async-storage`, `persistSession: true`, and `autoRefreshToken: true`. `AuthProvider` restores the session on launch and subscribes to `onAuthStateChange`.

## Navigation rules

| State | Access |
| --- | --- |
| Signed out | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` |
| Signed in | `/(app)` (minimal home + sign out). Public auth screens redirect here. |
| Recovery session | `/reset-password` to set a new password |

Wedding dashboard / create-wedding workflow are **not** part of this task.

## Testing locally

```powershell
npm run db:start
npm test
```

- Unit: Zod validation + safe error mapping (`*.test.ts`).
- Integration: `authService.integration.test.ts` hits local Auth + verifies `profiles` provisioning and sign-in / reset / sign-out.

## Security notes

- RLS stays on; the client only uses the anon key.
- Password-reset request UI always shows a generic confirmation (no account enumeration).
- Do not log passwords, tokens, or session secrets.
