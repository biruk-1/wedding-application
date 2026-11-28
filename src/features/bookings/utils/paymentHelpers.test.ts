import { describe, expect, it } from 'vitest';

import { summarizeBookingPayments } from '@/features/bookings/utils/paymentHelpers';

describe('summarizeBookingPayments', () => {
  it('suggests deposit when unpaid', () => {
    const summary = summarizeBookingPayments({
      totalAmount: 10000,
      depositAmount: 3000,
      payments: [],
    });
    expect(summary.nextPurpose).toBe('deposit');
    expect(summary.nextAmount).toBe(3000);
    expect(summary.isFullyPaid).toBe(false);
  });

  it('suggests balance after deposit', () => {
    const summary = summarizeBookingPayments({
      totalAmount: 10000,
      depositAmount: 3000,
      payments: [{ amount: 3000, status: 'success', purpose: 'deposit' }],
    });
    expect(summary.nextPurpose).toBe('balance');
    expect(summary.nextAmount).toBe(7000);
    expect(summary.hasSuccessfulDeposit).toBe(true);
  });

  it('marks fully paid', () => {
    const summary = summarizeBookingPayments({
      totalAmount: 5000,
      depositAmount: 5000,
      payments: [{ amount: 5000, status: 'success', purpose: 'full' }],
    });
    expect(summary.isFullyPaid).toBe(true);
    expect(summary.nextPurpose).toBeNull();
    expect(summary.nextAmount).toBe(0);
  });

  it('uses full when no deposit set', () => {
    const summary = summarizeBookingPayments({
      totalAmount: 2000,
      depositAmount: null,
      payments: [],
    });
    expect(summary.nextPurpose).toBe('full');
    expect(summary.nextAmount).toBe(2000);
  });
});
