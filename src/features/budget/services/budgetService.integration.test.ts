import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

vi.mock('@/lib/supabase', async () => {
  const { createClient: create } = await import('@supabase/supabase-js');
  return {
    supabase: create(
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      { auth: { persistSession: false, autoRefreshToken: false } },
    ),
  };
});

/* eslint-disable import/first -- vitest hoists vi.mock */
import { supabase } from '@/lib/supabase';
import {
  createBudgetItem,
  createPayment,
  deleteBudgetItem,
  getWeddingBudget,
  listBudgetItemSummaries,
  updateWeddingBudget,
} from '@/features/budget/services/budgetService';
import { computeBudgetSummary } from '@/features/budget/utils/budgetHelpers';
/* eslint-enable import/first */

const stamp = Date.now();
const password = 'TestPass1';
const emailA = `budget.a.${stamp}@example.com`;
const emailB = `budget.b.${stamp}@example.com`;

const anon: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let ready = false;
let weddingId: string | null = null;
let outsiderWeddingId: string | null = null;
let userId: string | null = null;
let itemId: string | null = null;

async function reachable(): Promise<boolean> {
  try {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    return response.ok;
  } catch {
    return false;
  }
}

describe('budget against local Supabase', () => {
  beforeAll(async () => {
    ready = await reachable();
    if (!ready) {
      console.warn(`[skip] Local Supabase unreachable at ${url}`);
      return;
    }

    const a = await supabase.auth.signUp({
      email: emailA,
      password,
      options: { data: { display_name: 'Budget A' } },
    });
    if (a.error || !a.data.user) {
      ready = false;
      return;
    }
    userId = a.data.user.id;

    const wedding = await supabase.rpc('create_wedding', {
      p_title: 'Budget Couple',
      p_partner_one_name: 'A',
      p_partner_two_name: 'B',
      p_currency_code: 'ETB',
    });
    if (wedding.error || !wedding.data?.id) {
      ready = false;
      return;
    }
    weddingId = wedding.data.id;

    const bClient = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const b = await bClient.auth.signUp({
      email: emailB,
      password,
      options: { data: { display_name: 'Budget B' } },
    });
    if (b.error) {
      ready = false;
      return;
    }
    const other = await bClient.rpc('create_wedding', {
      p_title: 'Other',
      p_partner_one_name: 'X',
      p_partner_two_name: 'Y',
    });
    if (other.error || !other.data?.id) {
      ready = false;
      return;
    }
    outsiderWeddingId = other.data.id;
    await bClient.auth.signOut();
  });

  afterAll(async () => {
    await supabase.auth.signOut();
    await anon.auth.signOut();
  });

  it('loads the budget created with the wedding and updates the total', async ({ skip }) => {
    if (!ready || !weddingId) skip();
    const budget = await getWeddingBudget(weddingId!);
    expect(budget.ok).toBe(true);
    if (!budget.ok) return;
    expect(budget.data.total_budget).toBe(0);
    expect(budget.data.currency_code).toBe('ETB');

    const updated = await updateWeddingBudget(weddingId!, { totalBudget: 150000 });
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.data.total_budget).toBe(150000);
  });

  it('creates an expense and records a partial payment', async ({ skip }) => {
    if (!ready || !weddingId || !userId) skip();

    const created = await createBudgetItem(weddingId!, {
      label: 'Venue deposit',
      estimatedAmount: 40000,
      committedAmount: 40000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    itemId = created.data.id;

    const payment = await createPayment(
      weddingId!,
      itemId,
      { amount: 10000, paidAt: new Date().toISOString(), paymentMethod: 'bank_transfer' },
      userId!,
    );
    expect(payment.ok).toBe(true);

    const summaries = await listBudgetItemSummaries(weddingId!);
    expect(summaries.ok).toBe(true);
    if (!summaries.ok) return;
    const item = summaries.data.find((row) => row.id === itemId);
    expect(item?.paid_total).toBe(10000);
    expect(item?.outstanding).toBe(30000);
    expect(item?.payment_status).toBe('partial');

    const budget = await getWeddingBudget(weddingId!);
    if (!budget.ok) return;
    const summary = computeBudgetSummary(
      budget.data,
      summaries.data.map((row) => ({
        id: row.id,
        estimated_amount: row.estimated_amount,
        committed_amount: row.committed_amount,
      })),
      summaries.data.flatMap((row) =>
        row.paid_total > 0 ? [{ budget_item_id: row.id, amount: row.paid_total }] : [],
      ),
    );
    expect(summary.actual).toBe(40000);
    expect(summary.paid).toBe(10000);
    expect(summary.outstanding).toBe(30000);
  });

  it('rejects payments that exceed the outstanding balance', async ({ skip }) => {
    if (!ready || !weddingId || !itemId || !userId) skip();
    const over = await createPayment(
      weddingId!,
      itemId!,
      { amount: 50000, paidAt: new Date().toISOString(), paymentMethod: 'cash' },
      userId!,
    );
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe('overpayment');
  });

  it('isolates budget rows across weddings', async ({ skip }) => {
    if (!ready || !weddingId || !outsiderWeddingId || !itemId) skip();

    const outsider = createClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await outsider.auth.signInWithPassword({ email: emailB, password });
    expect(signedIn.error).toBeNull();

    const leak = await outsider.from('budget_items').select('id').eq('id', itemId!);
    expect(leak.error).toBeNull();
    expect(leak.data ?? []).toHaveLength(0);

    const cross = await outsider.from('budget_items').insert({
      wedding_id: weddingId!,
      label: 'Should fail',
      estimated_amount: 10,
    });
    expect(cross.error).toBeTruthy();
    await outsider.auth.signOut();
  });

  it('deletes an expense and cascades its payments', async ({ skip }) => {
    if (!ready || !weddingId || !itemId) skip();
    const removed = await deleteBudgetItem(weddingId!, itemId!);
    expect(removed.ok).toBe(true);

    const payments = await supabase.from('expense_payments').select('id').eq('budget_item_id', itemId!);
    expect(payments.error).toBeNull();
    expect(payments.data ?? []).toHaveLength(0);
  });
});
