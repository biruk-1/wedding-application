import { describe, expect, it } from 'vitest';

import {
  budgetTotalSchema,
  expenseFormSchema,
  paymentFormSchema,
} from '@/features/budget/validation/budgetSchemas';

describe('budgetSchemas', () => {
  it('accepts a valid total budget', () => {
    const parsed = budgetTotalSchema.safeParse({ totalBudget: '250000', currencyCode: 'etb' });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.totalBudget).toBe(250000);
      expect(parsed.data.currencyCode).toBe('ETB');
    }
  });

  it('rejects invalid money input', () => {
    expect(budgetTotalSchema.safeParse({ totalBudget: '-10', currencyCode: 'ETB' }).success).toBe(
      false,
    );
    expect(budgetTotalSchema.safeParse({ totalBudget: '12.345', currencyCode: 'ETB' }).success).toBe(
      false,
    );
  });

  it('parses expense forms with optional committed amount', () => {
    const ok = expenseFormSchema.safeParse({
      label: 'Venue',
      categoryId: '',
      estimatedAmount: '1000',
      committedAmount: '',
      notes: '',
      weddingVendorId: '',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.committedAmount).toBeNull();
      expect(ok.data.categoryId).toBeNull();
    }

    const withCommitted = expenseFormSchema.safeParse({
      label: 'Venue',
      estimatedAmount: '1000',
      committedAmount: '900.5',
    });
    expect(withCommitted.success).toBe(true);
    if (withCommitted.success) expect(withCommitted.data.committedAmount).toBe(900.5);
  });

  it('requires positive payment amounts', () => {
    expect(
      paymentFormSchema.safeParse({ amount: '0', paidAt: '2026-01-01' }).success,
    ).toBe(false);
    const ok = paymentFormSchema.safeParse({
      amount: '50',
      paidAt: '2026-01-01',
      paymentMethod: 'telebirr',
    });
    expect(ok.success).toBe(true);
  });
});
