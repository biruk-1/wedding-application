import { addMoney, clampMoney, moneyGreater, subMoney } from '@/features/budget/utils/money';
import type {
  BookingPayment,
  BookingPaymentSummary,
  PaymentPurpose,
} from '@/features/bookings/types';

export function sumSuccessfulPayments(payments: Pick<BookingPayment, 'amount' | 'status'>[]): number {
  return payments
    .filter((payment) => payment.status === 'success')
    .reduce((sum, payment) => addMoney(sum, Number(payment.amount)), 0);
}

export function summarizeBookingPayments(input: {
  totalAmount: number | null | undefined;
  depositAmount: number | null | undefined;
  payments: Pick<BookingPayment, 'amount' | 'status' | 'purpose'>[];
}): BookingPaymentSummary {
  const totalAmount = clampMoney(Number(input.totalAmount ?? 0));
  const depositAmount =
    input.depositAmount == null ? null : clampMoney(Number(input.depositAmount));
  const paidAmount = sumSuccessfulPayments(input.payments);
  const remainingAmount = clampMoney(Math.max(0, subMoney(totalAmount, paidAmount)));

  const depositRemaining =
    depositAmount == null
      ? 0
      : clampMoney(Math.max(0, subMoney(depositAmount, paidAmount)));

  const hasSuccessfulDeposit =
    depositAmount == null
      ? paidAmount > 0
      : !moneyGreater(depositAmount, paidAmount);

  let nextPurpose: PaymentPurpose | null = null;
  let nextAmount = 0;

  if (remainingAmount <= 0) {
    nextPurpose = null;
    nextAmount = 0;
  } else if (depositAmount != null && depositAmount > 0 && depositRemaining > 0) {
    nextPurpose = 'deposit';
    nextAmount = Math.min(depositRemaining, remainingAmount);
  } else if (depositAmount != null && depositAmount > 0) {
    nextPurpose = 'balance';
    nextAmount = remainingAmount;
  } else {
    nextPurpose = 'full';
    nextAmount = remainingAmount;
  }

  return {
    totalAmount,
    depositAmount,
    paidAmount,
    remainingAmount,
    depositRemaining,
    nextPurpose,
    nextAmount,
    isFullyPaid: remainingAmount <= 0 && totalAmount > 0,
    hasSuccessfulDeposit,
  };
}

export function paymentPurposeLabel(purpose: string): string {
  switch (purpose) {
    case 'deposit':
      return 'Deposit';
    case 'balance':
      return 'Balance';
    case 'full':
      return 'Full payment';
    default:
      return purpose;
  }
}

export function bookingStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Awaiting vendor confirmation';
    case 'confirmed':
      return 'Confirmed';
    case 'fulfilled':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function quoteStatusLabel(status: string): string {
  switch (status) {
    case 'sent':
      return 'Awaiting your decision';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Declined';
    case 'expired':
      return 'Expired';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}
