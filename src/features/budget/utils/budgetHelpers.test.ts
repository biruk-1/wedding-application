import { describe, expect, it } from 'vitest';

import {
  buildCategoryBreakdown,
  canRecordPayment,
  computeBudgetSummary,
  enrichBudgetItem,
  itemDueAmount,
  itemOutstanding,
  paymentStatus,
} from '@/features/budget/utils/budgetHelpers';

const budget = { total_budget: 100000, currency_code: 'ETB' };

describe('budgetHelpers', () => {
  it('treats committed as due when present, else estimated', () => {
    expect(itemDueAmount({ estimated_amount: 1000, committed_amount: null })).toBe(1000);
    expect(itemDueAmount({ estimated_amount: 1000, committed_amount: 800 })).toBe(800);
  });

  it('computes empty budget summary', () => {
    const summary = computeBudgetSummary(budget, [], []);
    expect(summary).toMatchObject({
      totalBudget: 100000,
      allocated: 0,
      actual: 0,
      paid: 0,
      outstanding: 0,
      remaining: 100000,
      utilization: 0,
      overBudget: false,
      itemCount: 0,
    });
  });

  it('separates allocated, actual, paid, and outstanding', () => {
    const items = [
      { id: '1', estimated_amount: 40000, committed_amount: 35000 },
      { id: '2', estimated_amount: 20000, committed_amount: null },
    ];
    const payments = [
      { budget_item_id: '1', amount: 10000 },
      { budget_item_id: '1', amount: 5000 },
    ];
    const summary = computeBudgetSummary(budget, items, payments);
    expect(summary.allocated).toBe(60000);
    expect(summary.actual).toBe(35000); // only committed
    expect(summary.paid).toBe(15000);
    // item1 outstanding 35000-15000=20000; item2 due=20000 paid=0 → 20000
    expect(summary.outstanding).toBe(40000);
    expect(summary.remaining).toBe(65000);
    expect(summary.overBudget).toBe(false);
  });

  it('flags over-budget when actual exceeds total', () => {
    const summary = computeBudgetSummary(
      { total_budget: 1000, currency_code: 'ETB' },
      [{ id: '1', estimated_amount: 500, committed_amount: 1500 }],
      [],
    );
    expect(summary.overBudget).toBe(true);
    expect(summary.remaining).toBe(-500);
  });

  it('derives payment status and outstanding', () => {
    expect(paymentStatus(100, 0)).toBe('unpaid');
    expect(paymentStatus(100, 40)).toBe('partial');
    expect(paymentStatus(100, 100)).toBe('paid');
    expect(itemOutstanding(100, 40)).toBe(60);
    expect(itemOutstanding(100, 120)).toBe(0);
  });

  it('blocks payments that would exceed outstanding', () => {
    expect(canRecordPayment(100, 40, 60)).toBe(true);
    expect(canRecordPayment(100, 40, 60.01)).toBe(false);
    expect(canRecordPayment(100, 40, 0)).toBe(false);
  });

  it('builds category breakdown and over-allocation flags', () => {
    const rows = buildCategoryBreakdown(
      [
        {
          id: '1',
          category_id: 'c1',
          estimated_amount: 1000,
          committed_amount: 1200,
          category: { id: 'c1', slug: 'venue', name_en: 'Venue' },
        },
        {
          id: '2',
          category_id: 'c1',
          estimated_amount: 500,
          committed_amount: null,
          category: { id: 'c1', slug: 'venue', name_en: 'Venue' },
        },
        {
          id: '3',
          category_id: null,
          estimated_amount: 200,
          committed_amount: 50,
        },
      ],
      [{ budget_item_id: '1', amount: 300 }],
    );
    const venue = rows.find((row) => row.slug === 'venue');
    expect(venue?.allocated).toBe(1500);
    expect(venue?.actual).toBe(1200);
    expect(venue?.overAllocated).toBe(false);
    expect(venue?.paid).toBe(300);

    const over = buildCategoryBreakdown(
      [
        {
          id: '1',
          category_id: 'c1',
          estimated_amount: 100,
          committed_amount: 200,
          category: { id: 'c1', slug: 'food', name_en: 'Food' },
        },
      ],
      [],
    );
    expect(over[0]?.overAllocated).toBe(true);
  });

  it('enriches list items with payment fields', () => {
    const item = enrichBudgetItem({
      id: '1',
      wedding_id: 'w',
      category_id: null,
      wedding_vendor_id: null,
      booking_id: null,
      label: 'Venue deposit',
      estimated_amount: 5000,
      committed_amount: 5000,
      notes: null,
      created_at: '2026-01-01',
      payments: [{ id: 'p', amount: 2000, paid_at: '2026-01-02', payment_method: 'cash', reference: null }],
    });
    expect(item.paid_total).toBe(2000);
    expect(item.outstanding).toBe(3000);
    expect(item.payment_status).toBe('partial');
  });
});
