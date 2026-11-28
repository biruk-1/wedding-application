/**
 * Dev-only Chapa smoke test: initialize + verify a tiny charge without a booking.
 * Gated by test secret key (CHASECK_TEST*) or CHAPA_ALLOW_SMOKE_TEST=true.
 */
import {
  chapaInitialize,
  chapaVerify,
  jsonResponse,
  publicHttpUrl,
  requireChapaSecret,
} from '../_shared/chapa.ts';
import { createUserClient } from '../_shared/supabase.ts';

type Body = {
  action?: 'initialize' | 'verify';
  amount?: number | string;
  txRef?: string;
  returnUrl?: string;
};

const MAX_SMOKE_AMOUNT = 10;

function smokeAllowed(secret: string): boolean {
  if (Deno.env.get('CHAPA_ALLOW_SMOKE_TEST') === 'true') return true;
  return secret.includes('TEST') || secret.startsWith('CHASECK_TEST');
}

function smokeEmail(user: { id: string; email?: string | null }): string {
  const email = user.email?.trim();
  // Chapa rejects many synthetic / .local addresses — use account email or a safe test address.
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.local$/i.test(email)) {
    return email;
  }
  return 'abebech_bekele@gmail.com';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return jsonResponse({ ok: true });
  if (req.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'authentication required' }, 401);

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'authentication required' }, 401);

    const secret = requireChapaSecret();
    if (!smokeAllowed(secret)) {
      return jsonResponse(
        {
          error:
            'Smoke test blocked. Use a Chapa TEST secret key, or set CHAPA_ALLOW_SMOKE_TEST=true.',
        },
        403,
      );
    }

    const body = (await req.json()) as Body;
    const action = body.action ?? 'initialize';

    if (action === 'verify') {
      if (!body.txRef?.trim()) return jsonResponse({ error: 'txRef is required' }, 400);
      const verified = await chapaVerify(secret, body.txRef.trim());
      return jsonResponse({
        action: 'verify',
        tx_ref: body.txRef.trim(),
        chapa_status: verified.status,
        data: verified.data ?? null,
        message: verified.message,
        ok: String(verified.data?.status ?? '').toLowerCase() === 'success',
      });
    }

    const rawAmount = Number(body.amount ?? 1);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return jsonResponse({ error: 'amount must be a positive number' }, 400);
    }
    const amount = Math.min(rawAmount, MAX_SMOKE_AMOUNT);
    const txRef = `smoke_${user.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
    // Chapa return_url must be http(s). Deep links are opened by the app after checkout.
    const returnUrl =
      publicHttpUrl(body.returnUrl) ?? 'https://checkout.chapa.co';

    const chapa = await chapaInitialize(secret, {
      amount: amount.toFixed(2),
      currency: 'ETB',
      email: smokeEmail(user),
      first_name: 'Kiburan',
      last_name: 'SmokeTest',
      tx_ref: txRef,
      // Never send localhost/LAN callback — Chapa cannot reach your PC.
      return_url: returnUrl,
      customization: {
        title: 'KiburanTest',
        description: 'Dev smoke test',
      },
    });

    const checkoutUrl = chapa.data?.checkout_url;
    if (!checkoutUrl) {
      return jsonResponse({ error: 'Chapa did not return a checkout URL', raw: chapa }, 502);
    }

    return jsonResponse({
      action: 'initialize',
      ok: true,
      amount,
      currency: 'ETB',
      tx_ref: txRef,
      checkout_url: checkoutUrl,
      note: 'This charge is not linked to a wedding booking. Use the full Bookings flow to test budget mirror.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'smoke test failed';
    console.error('chapa-smoke-test', message);
    return jsonResponse({ error: message }, 500);
  }
});
