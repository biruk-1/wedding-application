/** Shared Chapa REST helpers for Edge Functions. */

export const CHAPA_BASE = 'https://api.chapa.co/v1';

export type ChapaInitializePayload = {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  tx_ref: string;
  callback_url?: string;
  return_url?: string;
  customization?: { title?: string; description?: string };
  meta?: Record<string, unknown>;
  subaccounts?: Array<{
    id: string;
    split_type?: 'percentage' | 'flat';
    split_value?: number;
  }>;
};

export type ChapaInitializeResponse = {
  message: string;
  status: string;
  data?: { checkout_url?: string; [key: string]: unknown };
};

export type ChapaVerifyResponse = {
  message: string;
  status: string;
  data?: {
    status?: string;
    amount?: number | string;
    currency?: string;
    tx_ref?: string;
    reference?: string;
    [key: string]: unknown;
  };
};

export function requireChapaSecret(): string {
  const key = Deno.env.get('CHAPA_SECRET_KEY')?.trim();
  if (!key || key.includes('replace-me')) {
    throw new Error('CHAPA_SECRET_KEY is not configured');
  }
  return key;
}

/** Chapa sometimes returns message as a string, array, or object. */
export function formatChapaMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) return message.map(String).join('; ');
  if (message && typeof message === 'object') {
    try {
      return JSON.stringify(message);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Only public https URLs are useful as Chapa callbacks (not localhost / LAN / deep links). */
export function publicHttpUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(parsed.hostname)) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export async function chapaInitialize(
  secretKey: string,
  payload: ChapaInitializePayload,
): Promise<ChapaInitializeResponse> {
  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as ChapaInitializeResponse & { message?: unknown };
  if (!res.ok || String(json.status).toLowerCase() !== 'success') {
    throw new Error(
      formatChapaMessage(json.message, `Chapa initialize failed (${res.status})`),
    );
  }
  return json;
}

export async function chapaVerify(
  secretKey: string,
  txRef: string,
): Promise<ChapaVerifyResponse> {
  const res = await fetch(`${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const json = (await res.json()) as ChapaVerifyResponse & { message?: unknown };
  if (!res.ok) {
    throw new Error(formatChapaMessage(json.message, `Chapa verify failed (${res.status})`));
  }
  return json;
}

export type ChapaSubaccountPayload = {
  business_name: string;
  account_name: string;
  bank_code: string | number;
  account_number: string;
  split_type: 'percentage' | 'flat';
  split_value: number;
};

export async function chapaCreateSubaccount(
  secretKey: string,
  payload: ChapaSubaccountPayload,
): Promise<{ message: string; status: string; data?: string | { id?: string } }> {
  const res = await fetch(`${CHAPA_BASE}/subaccount`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as {
    message: string;
    status: string;
    data?: string | { id?: string };
  };
  if (!res.ok) {
    throw new Error(
      formatChapaMessage(json.message, `Chapa subaccount failed (${res.status})`),
    );
  }
  return json;
}

/** HMAC-SHA256 hex digest of the raw body using the secret key (x-chapa-signature). */
export async function verifyChapaSignature(
  secretKey: string,
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex === signatureHeader.toLowerCase();
}

export function corsHeaders(origin = '*'): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-chapa-signature, chapa-signature',
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...headers },
  });
}
