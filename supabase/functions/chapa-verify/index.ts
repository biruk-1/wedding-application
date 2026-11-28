import { jsonResponse } from '../_shared/chapa.ts';
import { settleBookingPayment } from '../_shared/settlePayment.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';

type VerifyBody = { txRef?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'authentication required' }, 401);

    const body = (await req.json()) as VerifyBody;
    if (!body.txRef) return jsonResponse({ error: 'txRef is required' }, 400);

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'authentication required' }, 401);

    const admin = createServiceClient();
    const { data: payment } = await admin
      .from('booking_payments')
      .select('id, wedding_id, tx_ref, status')
      .eq('tx_ref', body.txRef)
      .maybeSingle();

    if (!payment) return jsonResponse({ error: 'payment not found' }, 404);

    const { data: access, error: accessError } = await userClient.rpc('get_my_wedding_access', {
      p_wedding_id: payment.wedding_id,
    });
    if (accessError || !access) {
      return jsonResponse({ error: 'not allowed' }, 403);
    }

    const result = await settleBookingPayment(admin, body.txRef);
    if (!result.ok) {
      return jsonResponse({ status: 'pending', error: result.error, tx_ref: body.txRef }, 200);
    }
    return jsonResponse({
      status: result.payment.status,
      payment: {
        id: result.payment.id,
        tx_ref: result.payment.tx_ref,
        amount: result.payment.amount,
        purpose: result.payment.purpose,
        status: result.payment.status,
        expense_payment_id: result.payment.expense_payment_id,
        budget_item_id: result.payment.budget_item_id,
      },
    });
  } catch (err) {
    console.error('chapa-verify', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'verify failed' },
      500,
    );
  }
});
