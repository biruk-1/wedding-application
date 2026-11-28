import {
  chapaCreateSubaccount,
  jsonResponse,
  requireChapaSecret,
} from '../_shared/chapa.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase.ts';

type RegisterBody = {
  vendorId?: string;
  businessName?: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string | number;
  /** Vendor share of each charge (default 0.95 = 95% to vendor, 5% platform). */
  splitValue?: number;
  splitType?: 'percentage' | 'flat';
};

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

    const body = (await req.json()) as RegisterBody;
    if (!body.vendorId) return jsonResponse({ error: 'vendorId is required' }, 400);
    if (!body.accountName?.trim()) return jsonResponse({ error: 'accountName is required' }, 400);
    if (!body.accountNumber?.trim()) {
      return jsonResponse({ error: 'accountNumber is required' }, 400);
    }
    if (body.bankCode == null || String(body.bankCode).trim() === '') {
      return jsonResponse({ error: 'bankCode is required' }, 400);
    }

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'authentication required' }, 401);

    const admin = createServiceClient();
    const { data: membership } = await admin
      .from('vendor_team_members')
      .select('role')
      .eq('vendor_id', body.vendorId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: vendor } = await admin
      .from('vendors')
      .select('id, business_name, owner_user_id, chapa_subaccount_id')
      .eq('id', body.vendorId)
      .maybeSingle();

    if (!vendor) return jsonResponse({ error: 'vendor not found' }, 404);

    const isManager =
      vendor.owner_user_id === user.id ||
      membership?.role === 'owner' ||
      membership?.role === 'manager';
    if (!isManager) {
      return jsonResponse({ error: 'only vendor owners/managers can register payouts' }, 403);
    }

    const splitType = body.splitType ?? 'percentage';
    const splitValue = body.splitValue ?? Number(Deno.env.get('CHAPA_VENDOR_SPLIT_VALUE') ?? 0.95);

    let subaccountId = vendor.chapa_subaccount_id;
    if (!subaccountId) {
      const secret = requireChapaSecret();
      const created = await chapaCreateSubaccount(secret, {
        business_name: (body.businessName ?? vendor.business_name).trim(),
        account_name: body.accountName.trim(),
        account_number: body.accountNumber.trim(),
        bank_code: body.bankCode,
        split_type: splitType,
        split_value: splitValue,
      });
      if (typeof created.data === 'string') {
        subaccountId = created.data;
      } else if (created.data && typeof created.data === 'object' && created.data.id) {
        subaccountId = created.data.id;
      }
      if (!subaccountId) {
        return jsonResponse({ error: 'Chapa did not return a subaccount id' }, 502);
      }
    }

    const { data: updated, error: rpcError } = await userClient.rpc('vendor_set_payout_details', {
      p_vendor_id: body.vendorId,
      p_account_name: body.accountName.trim(),
      p_account_number: body.accountNumber.trim(),
      p_bank_code: String(body.bankCode),
      p_chapa_subaccount_id: subaccountId,
      p_split_type: splitType,
      p_split_value: splitValue,
    });

    if (rpcError) return jsonResponse({ error: rpcError.message }, 400);

    return jsonResponse({
      vendor_id: body.vendorId,
      chapa_subaccount_id: subaccountId,
      payout: updated,
    });
  } catch (err) {
    console.error('chapa-register-subaccount', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'register failed' },
      500,
    );
  }
});
