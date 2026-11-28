import type { Database } from '@/types/database.types';

export type VendorQuote = Database['public']['Tables']['vendor_quotes']['Row'];
export type VendorBooking = Database['public']['Tables']['vendor_bookings']['Row'];
export type BookingPayment = Database['public']['Tables']['booking_payments']['Row'];

export type QuoteListItem = VendorQuote & {
  inquiry: {
    id: string;
    wedding_id: string;
    vendor_id: string;
    message: string | null;
    status: string;
    vendor: {
      id: string;
      business_name: string;
      city: string | null;
      logo_url: string | null;
      cover_url: string | null;
      chapa_subaccount_id: string | null;
    } | null;
  } | null;
};

export type BookingListItem = VendorBooking & {
  wedding_vendor: {
    id: string;
    wedding_id: string;
    vendor_id: string;
    status: string;
    vendor: {
      id: string;
      business_name: string;
      city: string | null;
      logo_url: string | null;
      cover_url: string | null;
      chapa_subaccount_id: string | null;
    } | null;
  } | null;
  payments: BookingPayment[];
  budget_item_id: string | null;
};

export type PaymentPurpose = 'deposit' | 'balance' | 'full';

export type BookingPaymentSummary = {
  totalAmount: number;
  depositAmount: number | null;
  paidAmount: number;
  remainingAmount: number;
  depositRemaining: number;
  nextPurpose: PaymentPurpose | null;
  nextAmount: number;
  isFullyPaid: boolean;
  hasSuccessfulDeposit: boolean;
};

export type AcceptQuoteResult = {
  booking_id: string;
  quote_id: string;
  inquiry_id: string;
  wedding_vendor_id: string;
  budget_item_id?: string;
  status: string;
  total_amount?: number;
  deposit_amount?: number | null;
  currency_code?: string;
};

export type ChapaCheckoutResult = {
  payment: {
    id: string;
    tx_ref: string;
    amount: number;
    purpose: string;
    status: string;
    checkout_url: string | null;
  };
  checkout_url: string;
};
