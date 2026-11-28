# Chapa payment test checklist

Use this to confirm Chapa works in Kiburan. Do **smoke test** first (gateway only), then the **full booking** path (quote → pay → budget).

## 0. One-time setup

- [ ] Docker Desktop running
- [ ] From `kiburan/`: `npm run db:start` then `npm run db:reset` (applies Chapa migration)
- [ ] `kiburan/supabase/.env` contains:

```env
CHAPA_SECRET_KEY=CHASECK_TEST-your-test-key
CHAPA_VENDOR_SPLIT_VALUE=0.95
CHAPA_ALLOW_UNSIGNED_WEBHOOKS=true
```

- [ ] App `.env` has only `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` (no Chapa secret)
- [ ] Edge Functions running:

```powershell
npx supabase functions serve --env-file supabase/.env
```

- [ ] Couple app started (`npx expo start`) against local Supabase
- [ ] You are signed in (smoke test requires auth)

Chapa test numbers / cards: use whatever Chapa documents for **test mode** in their dashboard.

---

## 1. Smoke test (gateway connectivity)

**Goal:** Prove secret key, Edge Function, and hosted checkout work — without a wedding booking.

### Open the screen

- [ ] **Signed in** → wedding **More → Settings → Developer → Chapa smoke test**
- [ ] Or go to route `/dev/chapa-test`
- [ ] (Optional) Welcome screen shows **Dev: Chapa smoke test** when local `__DEV__`

### Run payment

- [ ] Amount set to `1` (max allowed on this screen is **10 ETB**)
- [ ] Tap **Pay with Chapa (test)**
- [ ] Log shows a `tx_ref` and checkout opens
- [ ] Complete payment in Chapa test checkout (or cancel to confirm cancel path)
- [ ] After browser closes, tap **Verify status**
- [ ] Log / banner shows **SUCCESS** when the charge succeeded

### Pass criteria

| Check | Expected |
| --- | --- |
| Initialize | `checkout_url` returned, no “CHAPA_SECRET_KEY is not configured” |
| Checkout | Chapa UI loads (not a blank/error page) |
| Verify after success | `ok: true` / SUCCESS banner |
| Verify before pay / after cancel | Not success (pending/failed) — still a valid response |

### Common failures

| Symptom | Likely cause |
| --- | --- |
| **Edge Function returned a non-2xx status code** | (1) `functions serve` not running, (2) empty/`replace-me` secret in `supabase/.env`, or (3) Chapa rejected the payload (reload after latest fix — log should show Chapa’s real message). |
| Log shows `[object Object]` / vague Chapa error | Fixed in latest functions — restart `functions serve` so it reloads |
| authentication required | Not signed in |
| CHAPA_SECRET_KEY is not configured | Put your **test** key in `supabase/.env`, restart `functions serve` |
| Smoke test blocked | Live key without `CHAPA_ALLOW_SMOKE_TEST=true` |
| Functions invoke network error | Docker/API down, or phone can’t reach PC `:54321` |
| Screen hidden | Not `__DEV__` or Supabase URL not local |
| `db:status` shows `supabase_edge_runtime_*` stopped | Expected if you use `functions serve`; that serve process must stay open |

**Fix the non-2xx error (do this in order):**

1. Confirm `kiburan/supabase/.env` is **not empty** and contains your real test key:

```env
CHAPA_SECRET_KEY=CHASECK_TEST-...
CHAPA_VENDOR_SPLIT_VALUE=0.95
CHAPA_ALLOW_UNSIGNED_WEBHOOKS=true
```

2. In a **second** PowerShell (leave Expo running in the first):

```powershell
cd "C:\Users\biruk\Desktop\kiburan Wedding\kiburan"
npm run db:start
npx supabase functions serve --env-file supabase/.env
```

3. Reload the app, open **Chapa smoke test** again, tap **Pay with Chapa (test)**.
4. You should get a `tx_ref` and the Chapa checkout page — then **Verify status**.

---

## 2. Full marketplace payment (product path)

**Goal:** Quote → booking → Chapa deposit → budget mirror.

### Couple prepares

- [ ] Create/open a wedding (you need `vendors.manage` + budget pay permission — **owner** is fine)
- [ ] Marketplace → pick vendor → **Inquire**

### Vendor prepares (vendor app)

- [ ] Open the inquiry → **Send quote** (e.g. 5000 ETB)
- [ ] (Optional) Profile → **Chapa payouts** → link test bank / subaccount for split

### Couple accepts & pays

- [ ] Marketplace → **Quotes** → open quote → **Accept quote & create booking**
- [ ] Lands on booking (or **Bookings & pay**)
- [ ] Booking shows total + deposit (~30% if amount ≥ 1000)
- [ ] Tap **Pay deposit · …**
- [ ] Complete Chapa test checkout
- [ ] Booking payment history shows **success**
- [ ] Remaining amount drops (deposit paid)

### Budget mirror

- [ ] Wedding → **Budget** → expense created for that vendor/booking
- [ ] Expense payments list includes a **chapa** payment with the same `tx_ref` / reference

### Optional second charge

- [ ] On same booking, pay **balance**
- [ ] Booking shows fully paid
- [ ] Budget reflects both payments

### Pass criteria

| Check | Expected |
| --- | --- |
| Accept quote | Booking + budget line created |
| Pay deposit | `booking_payments` success + Chapa verify OK |
| Budget | `expense_payments.payment_method = chapa` |
| Split (if vendor linked) | Initialize used vendor `chapa_subaccount_id` (see function logs / payment row) |

---

## 3. What not to use for gateway testing

- Budget → Record payment → method **chapa** — manual bookkeeping only, does **not** call Chapa
- Inquiry screen — not a charge
- Production / live Chapa keys on this smoke screen — blocked unless you explicitly allow it

---

## 4. Quick command reference

```powershell
# DB
npm run db:status
npm run db:reset

# Functions (keep this terminal open)
npx supabase functions serve --env-file supabase/.env

# App
npx expo start
```

Studio (optional): http://127.0.0.1:54323 — inspect `booking_payments` and `expense_payments` after a full-path pay.

---

## 5. Sign-off

| Area | Tester | Date | Pass? | Notes |
| --- | --- | --- | --- | --- |
| Smoke initialize + checkout | | | | |
| Smoke verify success | | | | |
| Quote accept → booking | | | | |
| Pay deposit | | | | |
| Budget chapa mirror | | | | |
| Pay balance (optional) | | | | |
| Vendor payout link (optional) | | | | |
