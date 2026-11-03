# Notifications — backend proposal (Task 11)

## Discovery

Audited as of Task 11:

| Area | Status |
| --- | --- |
| Notification tables | **None** in PM baseline |
| Device / push token tables | **None** |
| Edge Functions for push | **None** |
| DB triggers that emit notifications | **None** |
| `expo-notifications` dependency | **Not installed** |

Therefore Kiburan does **not** ship an in-app notification feed or push delivery in this milestone. Building a UI over empty / mocked events would be a fake system.

## Recommended schema (for PM review)

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wedding_id uuid references public.weddings(id) on delete cascade,
  category text not null check (category in (
    'task', 'event', 'rsvp', 'vendor', 'budget', 'invitation', 'system'
  )),
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  categories jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
```

RLS: users read/update only their own rows. Inserts via `SECURITY DEFINER` triggers / Edge Functions after domain events (task assigned, RSVP submitted, etc.).

## Push delivery

1. App registers Expo push token → `device_push_tokens`.
2. Edge Function reads preferences + tokens and calls Expo Push API.
3. Deep link `data` includes `weddingId` + feature route.

## App follow-up (after backend lands)

- Install `expo-notifications`.
- Notification list screen + unread badge on Home bell.
- Wire preference toggles in Settings (already reserved as “not available yet”).
