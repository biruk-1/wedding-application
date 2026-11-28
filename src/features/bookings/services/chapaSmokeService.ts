import { mapBookingError, type BookingUserMessage } from '@/features/bookings/services/bookingErrors';
import { supabase } from '@/lib/supabase';

export type ChapaSmokeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BookingUserMessage };

type FunctionsErrorBody = { error?: string; message?: string };

function fail(error: { message?: string; code?: string } | Error | null): ChapaSmokeResult<never> {
  return { ok: false, error: mapBookingError(error) };
}

/** Pull the real Edge Function JSON error when invoke only says "non-2xx". */
async function invokeErrorMessage(
  error: { message?: string; context?: unknown } | null,
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && (data as FunctionsErrorBody).error) {
    return String((data as FunctionsErrorBody).error);
  }
  const context = error && 'context' in error ? error.context : null;
  if (context && typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = await context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return String(body.error);
      }
      return JSON.stringify(body);
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.slice(0, 300);
      } catch {
        // ignore
      }
    }
  }
  const msg = error?.message ?? 'Smoke request failed';
  if (/non-2xx/i.test(msg)) {
    return `${msg}. Is Edge Functions running? In kiburan run: npx supabase functions serve --env-file supabase/.env`;
  }
  return msg;
}

export type SmokeInitializeResult = {
  action: 'initialize';
  ok: boolean;
  amount: number;
  currency: string;
  tx_ref: string;
  checkout_url: string;
  note?: string;
};

export type SmokeVerifyResult = {
  action: 'verify';
  tx_ref: string;
  chapa_status: string;
  ok: boolean;
  message?: string;
  data?: unknown;
  error?: string;
};

export async function smokeInitializeChapa(input: {
  amount: number;
  returnUrl?: string;
}): Promise<ChapaSmokeResult<SmokeInitializeResult>> {
  const { data, error } = await supabase.functions.invoke<SmokeInitializeResult | FunctionsErrorBody>(
    'chapa-smoke-test',
    {
      body: {
        action: 'initialize',
        amount: input.amount,
        returnUrl: input.returnUrl,
      },
    },
  );

  if (error) return fail(new Error(await invokeErrorMessage(error, data)));
  if (!data || typeof data !== 'object') {
    return fail(new Error('Empty response from chapa-smoke-test'));
  }
  if ('error' in data && data.error) return fail(new Error(String(data.error)));
  if (!('checkout_url' in data) || !data.checkout_url) {
    return fail(new Error('No checkout_url returned'));
  }
  return { ok: true, data: data as SmokeInitializeResult };
}

export async function smokeVerifyChapa(
  txRef: string,
): Promise<ChapaSmokeResult<SmokeVerifyResult>> {
  const { data, error } = await supabase.functions.invoke<SmokeVerifyResult | FunctionsErrorBody>(
    'chapa-smoke-test',
    {
      body: { action: 'verify', txRef },
    },
  );

  if (error) return fail(new Error(await invokeErrorMessage(error, data)));
  if (!data || typeof data !== 'object') {
    return fail(new Error('Empty response from chapa-smoke-test'));
  }
  if ('error' in data && data.error && !('action' in data)) {
    return fail(new Error(String((data as FunctionsErrorBody).error)));
  }
  return { ok: true, data: data as SmokeVerifyResult };
}
