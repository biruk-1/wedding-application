import { jsonResponse, requireChapaSecret, verifyChapaSignature } from '../_shared/chapa.ts';
import { settleBookingPayment } from '../_shared/settlePayment.ts';
import { createServiceClient } from '../_shared/supabase.ts';

function extractTxRef(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const candidates = [obj.tx_ref, obj.trx_ref, obj.txRef];
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data as Record<string, unknown>;
    candidates.push(data.tx_ref, data.trx_ref);
  }
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  try {
    const secret = requireChapaSecret();
    const admin = createServiceClient();

    // Chapa callback_url may GET with query params; webhooks POST JSON.
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const txRef =
        url.searchParams.get('trx_ref') ??
        url.searchParams.get('tx_ref') ??
        url.searchParams.get('ref_id');
      if (!txRef) return jsonResponse({ error: 'missing tx ref' }, 400);
      const result = await settleBookingPayment(admin, txRef, {
        source: 'callback_get',
        query: Object.fromEntries(url.searchParams.entries()),
      });
      if (!result.ok) return jsonResponse({ status: 'ignored', error: result.error }, 200);
      return jsonResponse({ status: 'success', tx_ref: txRef });
    }

    const rawBody = await req.text();
    const signature =
      req.headers.get('x-chapa-signature') ?? req.headers.get('chapa-signature');

    // Prefer signed webhooks; allow unsigned only in explicit test mode.
    const allowUnsigned = Deno.env.get('CHAPA_ALLOW_UNSIGNED_WEBHOOKS') === 'true';
    if (signature) {
      const valid = await verifyChapaSignature(secret, rawBody, signature);
      if (!valid) return jsonResponse({ error: 'invalid signature' }, 401);
    } else if (!allowUnsigned) {
      return jsonResponse({ error: 'missing signature' }, 401);
    }

    let payload: unknown = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return jsonResponse({ error: 'invalid json' }, 400);
    }

    const txRef = extractTxRef(payload);
    if (!txRef) return jsonResponse({ error: 'missing tx_ref' }, 400);

    const result = await settleBookingPayment(admin, txRef, payload);
    // Always 200 to Chapa once we accepted the payload — retries are handled by verify.
    if (!result.ok) {
      console.error('chapa-webhook settle', result.error);
      return jsonResponse({ status: 'received', error: result.error }, 200);
    }
    return jsonResponse({ status: 'success', tx_ref: txRef });
  } catch (err) {
    console.error('chapa-webhook', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'webhook failed' },
      500,
    );
  }
});
