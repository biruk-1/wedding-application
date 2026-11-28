import {
  chapaInitialize,
  jsonResponse,
  publicHttpUrl,
  requireChapaSecret,
} from '../_shared/chapa.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';

type InitBody = {
  bookingId?: string;
  purpose?: 'deposit' | 'balance' | 'full';
  returnUrl?: string;
};

type WeddingVendorJoin = {
  id: string;
  wedding_id: string;
  vendor_id: string;
  vendors: {
    id: string;
    business_name: string;
    chapa_subaccount_id: string | null;
    payout_split_type: string | null;
    payout_split_value: number | null;
  };
};

function canCreateExpensePayment(access: unknown): boolean {
  if (!access || typeof access !== 'object') return false;
  const role = 'role' in access ? String((access as { role?: string }).role ?? '') : '';
  if (role === 'owner') return true;
  const permissions = (access as { permissions?: unknown }).permissions;
  if (!Array.isArray(permissions)) return false;
  return (
    permissions.includes('budget.expenses.create') || permissions.includes('vendors.manage')
  );
}

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

    const body = (await req.json()) as InitBody;
    if (!body.bookingId) return jsonResponse({ error: 'bookingId is required' }, 400);

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'authentication required' }, 401);

    const admin = createServiceClient();

    const { data: booking, error: bookingError } = await admin
      .from('vendor_bookings')
      .select(
        `
        id, total_amount, deposit_amount, currency_code, status, wedding_vendor_id,
        wedding_vendors!inner (
          id, wedding_id, vendor_id,
          vendors!inner (
            id, business_name, chapa_subaccount_id, payout_split_type, payout_split_value
          )
        )
      `,
      )
      .eq('id', body.bookingId)
      .maybeSingle();

    if (bookingError) return jsonResponse({ error: bookingError.message }, 400);
    if (!booking) return jsonResponse({ error: 'booking not found' }, 404);
    if (booking.status === 'cancelled') {
      return jsonResponse({ error: 'cancelled bookings cannot be paid' }, 400);
    }

    const wv = booking.wedding_vendors as unknown as WeddingVendorJoin;

    const { data: access, error: accessError } = await userClient.rpc('get_my_wedding_access', {
      p_wedding_id: wv.wedding_id,
    });
    if (accessError || !canCreateExpensePayment(access)) {
      return jsonResponse({ error: 'you do not have permission to pay for this booking' }, 403);
    }

    const { data: paidRows } = await admin
      .from('booking_payments')
      .select('amount, purpose, status')
      .eq('booking_id', booking.id)
      .eq('status', 'success');

    const paidTotal = (paidRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
    const total = Number(booking.total_amount ?? 0);
    const deposit = booking.deposit_amount != null ? Number(booking.deposit_amount) : null;
    const remaining = Math.max(0, Math.round((total - paidTotal) * 100) / 100);

    if (remaining <= 0) {
      return jsonResponse({ error: 'this booking is already fully paid' }, 400);
    }

    let purpose: 'deposit' | 'balance' | 'full' = body.purpose ?? 'full';
    let amount = remaining;

    if (!body.purpose) {
      if (deposit != null && deposit > 0 && paidTotal + 0.001 < deposit) {
        purpose = 'deposit';
        amount = Math.min(remaining, Math.round((deposit - paidTotal) * 100) / 100);
      } else if (deposit != null && deposit > 0 && paidTotal + 0.001 >= deposit) {
        purpose = 'balance';
        amount = remaining;
      } else {
        purpose = 'full';
        amount = remaining;
      }
    } else if (purpose === 'deposit' && deposit != null) {
      amount = Math.min(remaining, Math.max(0, Math.round((deposit - paidTotal) * 100) / 100));
    } else {
      amount = remaining;
    }

    if (amount <= 0) {
      return jsonResponse({ error: 'nothing left to pay for this purpose' }, 400);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, phone')
      .eq('id', user.id)
      .maybeSingle();

    const displayName = (profile?.display_name ?? 'Guest').trim() || 'Guest';
    const nameParts = displayName.split(/\s+/);
    const firstName = nameParts[0] ?? 'Guest';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';
    const rawEmail = user.email?.trim();
    const email =
      rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) && !/\.local$/i.test(rawEmail)
        ? rawEmail
        : 'abebech_bekele@gmail.com';
    const phone = profile?.phone?.replace(/\D/g, '') ?? undefined;
    const phoneNormalized =
      phone && phone.length === 10 && (phone.startsWith('09') || phone.startsWith('07'))
        ? phone
        : undefined;

    const txRef = `kb_${booking.id.replace(/-/g, '').slice(0, 8)}_${Date.now()}`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const callbackUrl = publicHttpUrl(`${supabaseUrl}/functions/v1/chapa-webhook`);
    const returnUrl =
      publicHttpUrl(body.returnUrl) ?? 'https://checkout.chapa.co';

    const vendor = wv.vendors;
    const subaccounts = vendor.chapa_subaccount_id
      ? [
          {
            id: vendor.chapa_subaccount_id,
            split_type:
              (vendor.payout_split_type as 'percentage' | 'flat' | null) ?? 'percentage',
            split_value: Number(vendor.payout_split_value ?? 0.95),
          },
        ]
      : undefined;

    const secret = requireChapaSecret();
    const chapa = await chapaInitialize(secret, {
      amount: amount.toFixed(2),
      currency: booking.currency_code || 'ETB',
      email,
      first_name: firstName,
      last_name: lastName,
      phone_number: phoneNormalized,
      tx_ref: txRef,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      return_url: returnUrl,
      customization: {
        title: 'KiburanPay',
        description: `${purpose} ${vendor.business_name}`.slice(0, 50),
      },
      subaccounts,
    });

    const checkoutUrl = chapa.data?.checkout_url;
    if (!checkoutUrl) {
      return jsonResponse({ error: 'Chapa did not return a checkout URL' }, 502);
    }

    const { data: budgetItem } = await admin
      .from('budget_items')
      .select('id')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: paymentRow, error: insertError } = await admin
      .from('booking_payments')
      .insert({
        booking_id: booking.id,
        wedding_id: wv.wedding_id,
        payer_user_id: user.id,
        tx_ref: txRef,
        amount,
        currency_code: booking.currency_code || 'ETB',
        purpose,
        status: 'pending',
        checkout_url: checkoutUrl,
        budget_item_id: budgetItem?.id ?? null,
        vendor_subaccount_id: vendor.chapa_subaccount_id,
        platform_split_type: subaccounts?.[0]?.split_type ?? null,
        platform_split_value: subaccounts?.[0]?.split_value ?? null,
        raw_initialize: chapa,
      })
      .select('id, tx_ref, amount, purpose, status, checkout_url')
      .single();

    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    return jsonResponse({
      payment: paymentRow,
      checkout_url: checkoutUrl,
    });
  } catch (err) {
    console.error('chapa-initialize', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'initialize failed' },
      500,
    );
  }
});
