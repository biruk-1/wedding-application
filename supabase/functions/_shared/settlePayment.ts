import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

import { chapaVerify, requireChapaSecret } from './chapa.ts';

type BookingPaymentRow = {
  id: string;
  booking_id: string;
  wedding_id: string;
  payer_user_id: string;
  tx_ref: string;
  amount: number;
  currency_code: string;
  purpose: string;
  status: string;
  budget_item_id: string | null;
  expense_payment_id: string | null;
};

/**
 * Verify with Chapa and mark the booking payment successful.
 * On first success, mirrors into expense_payments on the booking's budget item.
 */
export async function settleBookingPayment(
  admin: SupabaseClient,
  txRef: string,
  webhookPayload?: unknown,
): Promise<{ ok: true; payment: BookingPaymentRow } | { ok: false; error: string }> {
  const secret = requireChapaSecret();

  const { data: payment, error: loadError } = await admin
    .from('booking_payments')
    .select('*')
    .eq('tx_ref', txRef)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!payment) return { ok: false, error: 'payment not found' };

  if (payment.status === 'success' && payment.expense_payment_id) {
    return { ok: true, payment: payment as BookingPaymentRow };
  }

  let verifyJson: Awaited<ReturnType<typeof chapaVerify>>;
  try {
    verifyJson = await chapaVerify(secret, txRef);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'verify failed' };
  }

  const chapaStatus = String(verifyJson.data?.status ?? '').toLowerCase();
  const verifiedAmount = Number(verifyJson.data?.amount ?? 0);
  const patch: Record<string, unknown> = {
    raw_verify: verifyJson,
    chapa_ref: verifyJson.data?.reference ?? payment.chapa_ref,
    updated_at: new Date().toISOString(),
  };
  if (webhookPayload !== undefined) {
    patch.raw_webhook = webhookPayload;
  }

  if (chapaStatus !== 'success') {
    patch.status = chapaStatus === 'failed' || chapaStatus === 'cancelled' ? chapaStatus : 'failed';
    await admin.from('booking_payments').update(patch).eq('id', payment.id);
    return { ok: false, error: `payment status is ${chapaStatus || 'unknown'}` };
  }

  // Amount sanity: allow tiny float noise
  if (
    Number.isFinite(verifiedAmount) &&
    verifiedAmount > 0 &&
    Math.abs(verifiedAmount - Number(payment.amount)) > 0.05
  ) {
    patch.status = 'failed';
    await admin.from('booking_payments').update(patch).eq('id', payment.id);
    return { ok: false, error: 'verified amount mismatch' };
  }

  let budgetItemId = payment.budget_item_id as string | null;
  if (!budgetItemId) {
    const { data: item } = await admin
      .from('budget_items')
      .select('id')
      .eq('booking_id', payment.booking_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    budgetItemId = item?.id ?? null;
  }

  let expensePaymentId = payment.expense_payment_id as string | null;
  if (!expensePaymentId && budgetItemId) {
    const { data: expense, error: expenseError } = await admin
      .from('expense_payments')
      .insert({
        budget_item_id: budgetItemId,
        amount: payment.amount,
        paid_at: new Date().toISOString(),
        payment_method: 'chapa',
        reference: txRef,
        notes: `Chapa ${payment.purpose} payment`,
        recorded_by: payment.payer_user_id,
      })
      .select('id')
      .single();
    if (expenseError) {
      return { ok: false, error: expenseError.message };
    }
    expensePaymentId = expense.id;
  }

  patch.status = 'success';
  patch.verified_at = new Date().toISOString();
  patch.budget_item_id = budgetItemId;
  patch.expense_payment_id = expensePaymentId;

  const { data: updated, error: updateError } = await admin
    .from('booking_payments')
    .update(patch)
    .eq('id', payment.id)
    .select('*')
    .single();

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, payment: updated as BookingPaymentRow };
}
