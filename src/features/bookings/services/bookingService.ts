import { mapBookingError, type BookingUserMessage } from '@/features/bookings/services/bookingErrors';
import type {
  AcceptQuoteResult,
  BookingListItem,
  BookingPayment,
  QuoteListItem,
} from '@/features/bookings/types';
import { supabase } from '@/lib/supabase';

export type BookingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: BookingUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): BookingResult<never> {
  return { ok: false, error: mapBookingError(error) };
}

const QUOTE_SELECT = `
  id, inquiry_id, package_id, amount, currency_code, description, valid_until, status, created_at, updated_at,
  inquiry:vendor_inquiries!inner (
    id, wedding_id, vendor_id, message, status,
    vendor:vendors (
      id, business_name, city, logo_url, cover_url, chapa_subaccount_id
    )
  )
`;

const BOOKING_SELECT = `
  id, wedding_vendor_id, quote_id, booking_date, start_at, end_at,
  total_amount, deposit_amount, currency_code, status, contract_storage_path, notes, created_at, updated_at,
  wedding_vendor:wedding_vendors!inner (
    id, wedding_id, vendor_id, status,
    vendor:vendors (
      id, business_name, city, logo_url, cover_url, chapa_subaccount_id
    )
  ),
  payments:booking_payments (
    id, booking_id, wedding_id, payer_user_id, tx_ref, chapa_ref, amount, currency_code,
    purpose, status, checkout_url, budget_item_id, expense_payment_id, verified_at, created_at, updated_at
  )
`;

function mapQuote(row: QuoteListItem): QuoteListItem {
  return {
    ...row,
    amount: Number(row.amount),
  };
}

function mapBooking(row: BookingListItem & { budget_items?: { id: string }[] | null }): BookingListItem {
  const payments = (row.payments ?? []).map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  })) as BookingPayment[];
  return {
    ...row,
    total_amount: row.total_amount == null ? null : Number(row.total_amount),
    deposit_amount: row.deposit_amount == null ? null : Number(row.deposit_amount),
    payments,
    budget_item_id: row.budget_items?.[0]?.id ?? row.budget_item_id ?? null,
  };
}

export async function listWeddingQuotes(
  weddingId: string,
  signal?: AbortSignal,
): Promise<BookingResult<QuoteListItem[]>> {
  let query = supabase
    .from('vendor_quotes')
    .select(QUOTE_SELECT)
    .eq('inquiry.wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as unknown as QuoteListItem[]).map(mapQuote) };
}

export async function getWeddingQuote(
  weddingId: string,
  quoteId: string,
  signal?: AbortSignal,
): Promise<BookingResult<QuoteListItem | null>> {
  let query = supabase
    .from('vendor_quotes')
    .select(QUOTE_SELECT)
    .eq('id', quoteId)
    .eq('inquiry.wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapQuote(data as unknown as QuoteListItem) };
}

export async function acceptVendorQuote(
  quoteId: string,
): Promise<BookingResult<AcceptQuoteResult>> {
  const { data, error } = await supabase.rpc('accept_vendor_quote', {
    p_quote_id: quoteId,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') {
    return fail(new Error('Accept quote returned no booking.'));
  }
  return { ok: true, data: data as AcceptQuoteResult };
}

export async function listWeddingBookings(
  weddingId: string,
  signal?: AbortSignal,
): Promise<BookingResult<BookingListItem[]>> {
  let query = supabase
    .from('vendor_bookings')
    .select(
      `${BOOKING_SELECT},
      budget_items ( id )`,
    )
    .eq('wedding_vendor.wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return {
    ok: true,
    data: ((data ?? []) as unknown as (BookingListItem & { budget_items?: { id: string }[] })[]).map(
      mapBooking,
    ),
  };
}

export async function getWeddingBooking(
  weddingId: string,
  bookingId: string,
  signal?: AbortSignal,
): Promise<BookingResult<BookingListItem | null>> {
  let query = supabase
    .from('vendor_bookings')
    .select(
      `${BOOKING_SELECT},
      budget_items ( id )`,
    )
    .eq('id', bookingId)
    .eq('wedding_vendor.wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: true, data: null };
  return {
    ok: true,
    data: mapBooking(data as unknown as BookingListItem & { budget_items?: { id: string }[] }),
  };
}
