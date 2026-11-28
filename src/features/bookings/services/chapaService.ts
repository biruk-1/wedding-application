import { mapBookingError, type BookingUserMessage } from '@/features/bookings/services/bookingErrors';
import type { ChapaCheckoutResult, PaymentPurpose } from '@/features/bookings/types';
import { supabase } from '@/lib/supabase';

export type ChapaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BookingUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): ChapaResult<never> {
  return { ok: false, error: mapBookingError(error) };
}

type FunctionsErrorBody = { error?: string; message?: string };

function functionErrorMessage(error: {
  message?: string;
  context?: { json?: () => Promise<unknown> } | null;
}): Promise<string> {
  return Promise.resolve(error.message ?? 'Payment request failed');
}

export async function initializeBookingCheckout(input: {
  bookingId: string;
  purpose?: PaymentPurpose;
  returnUrl?: string;
}): Promise<ChapaResult<ChapaCheckoutResult>> {
  const { data, error } = await supabase.functions.invoke<ChapaCheckoutResult | FunctionsErrorBody>(
    'chapa-initialize',
    {
      body: {
        bookingId: input.bookingId,
        purpose: input.purpose,
        returnUrl: input.returnUrl,
      },
    },
  );

  if (error) {
    const message = await functionErrorMessage(error);
    return fail(new Error(message));
  }
  if (!data || typeof data !== 'object') {
    return fail(new Error('Payment gateway returned an empty response.'));
  }
  if ('error' in data && data.error) {
    return fail(new Error(String(data.error)));
  }
  if (!('checkout_url' in data) || !data.checkout_url) {
    return fail(new Error('Payment gateway did not return a checkout URL.'));
  }
  return { ok: true, data: data as ChapaCheckoutResult };
}

export async function verifyBookingCheckout(txRef: string): Promise<
  ChapaResult<{
    status: string;
    payment?: {
      id: string;
      tx_ref: string;
      amount: number;
      purpose: string;
      status: string;
      expense_payment_id: string | null;
      budget_item_id: string | null;
    };
    error?: string;
  }>
> {
  const { data, error } = await supabase.functions.invoke('chapa-verify', {
    body: { txRef },
  });
  if (error) {
    const message = await functionErrorMessage(error);
    return fail(new Error(message));
  }
  if (!data || typeof data !== 'object') {
    return fail(new Error('Verify returned an empty response.'));
  }
  if ('error' in data && data.error && !('status' in data)) {
    return fail(new Error(String((data as FunctionsErrorBody).error)));
  }
  return { ok: true, data: data as { status: string } };
}

export async function registerVendorSubaccount(input: {
  vendorId: string;
  businessName?: string;
  accountName: string;
  accountNumber: string;
  bankCode: string | number;
  splitValue?: number;
  splitType?: 'percentage' | 'flat';
}): Promise<ChapaResult<{ vendor_id: string; chapa_subaccount_id: string }>> {
  const { data, error } = await supabase.functions.invoke('chapa-register-subaccount', {
    body: input,
  });
  if (error) {
    const message = await functionErrorMessage(error);
    return fail(new Error(message));
  }
  if (!data || typeof data !== 'object') {
    return fail(new Error('Subaccount registration returned an empty response.'));
  }
  if ('error' in data && (data as FunctionsErrorBody).error) {
    return fail(new Error(String((data as FunctionsErrorBody).error)));
  }
  return {
    ok: true,
    data: data as { vendor_id: string; chapa_subaccount_id: string },
  };
}
