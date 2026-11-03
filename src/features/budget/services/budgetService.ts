import { mapBudgetError, type BudgetUserMessage } from '@/features/budget/services/budgetErrors';
import {
  BUDGET_CATEGORY_COLUMNS,
  BUDGET_ITEM_DETAIL_SELECT,
  BUDGET_ITEM_LIST_SELECT,
  BUDGET_SUMMARY_ITEM_SELECT,
  PAYMENT_COLUMNS,
  WEDDING_BUDGET_COLUMNS,
} from '@/features/budget/services/budgetSelects';
import type {
  BudgetCategory,
  BudgetItemInput,
  BudgetItemListItem,
  BudgetItemListPage,
  BudgetItemWithRelations,
  BudgetServerFilters,
  ExpensePayment,
  PaymentInput,
  WeddingBudget,
  WeddingBudgetUpdate,
  WeddingVendorOption,
} from '@/features/budget/types';
import {
  canRecordPayment,
  enrichBudgetItem,
  itemDueAmount,
  sumPayments,
} from '@/features/budget/utils/budgetHelpers';
import { clampMoney } from '@/features/budget/utils/money';
import type { ServiceResult } from '@/lib/query/queryError';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

export const BUDGET_PAGE_SIZE = 40;

type BudgetResult<T> = ServiceResult<T>;

function fail(error: { message?: string; code?: string } | Error | null): BudgetResult<never> {
  return { ok: false, error: mapBudgetError(error) };
}

function notFound(message: string): BudgetResult<never> {
  return { ok: false, error: { code: 'not_found', message } };
}

type EmbedOne<T> = T | T[] | null;

function one<T>(value: EmbedOne<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type RawListRow = Parameters<typeof enrichBudgetItem>[0] & {
  category: EmbedOne<{ id: string; slug: string; name_en: string }>;
  payments: Parameters<typeof enrichBudgetItem>[0]['payments'];
};

function normalizeListItem(row: RawListRow): BudgetItemListItem {
  return enrichBudgetItem({
    ...row,
    category: one(row.category),
    payments: row.payments ?? [],
  });
}

// --- Categories ------------------------------------------------------------------------------

export async function listBudgetCategories(
  signal?: AbortSignal,
): Promise<BudgetResult<BudgetCategory[]>> {
  let query = supabase
    .from('budget_categories')
    .select(BUDGET_CATEGORY_COLUMNS)
    .order('name_en', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as BudgetCategory[] };
}

// --- Wedding budget header -------------------------------------------------------------------

export async function getWeddingBudget(
  weddingId: string,
  signal?: AbortSignal,
): Promise<BudgetResult<WeddingBudget>> {
  let query = supabase
    .from('wedding_budgets')
    .select(WEDDING_BUDGET_COLUMNS)
    .eq('wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return fail({ code: 'budget_missing', message: 'budget_missing' });
  }
  return {
    ok: true,
    data: {
      ...data,
      total_budget: Number(data.total_budget),
    } as WeddingBudget,
  };
}

export async function updateWeddingBudget(
  weddingId: string,
  input: WeddingBudgetUpdate,
): Promise<BudgetResult<WeddingBudget>> {
  const patch: Database['public']['Tables']['wedding_budgets']['Update'] = {
    total_budget: clampMoney(input.totalBudget),
  };
  if (input.currencyCode) {
    patch.currency_code = input.currencyCode.trim().toUpperCase().slice(0, 3);
  }

  const { data, error } = await supabase
    .from('wedding_budgets')
    .update(patch)
    .eq('wedding_id', weddingId)
    .select(WEDDING_BUDGET_COLUMNS)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return fail({ code: 'budget_missing', message: 'budget_missing' });
  return {
    ok: true,
    data: { ...data, total_budget: Number(data.total_budget) } as WeddingBudget,
  };
}

// --- Items -----------------------------------------------------------------------------------

function escapeIlike(raw: string): string {
  return raw.replace(/[%_,]/g, '').trim().slice(0, 80);
}

export async function listBudgetItemSummaries(
  weddingId: string,
  signal?: AbortSignal,
): Promise<BudgetResult<BudgetItemListItem[]>> {
  let query = supabase
    .from('budget_items')
    .select(BUDGET_SUMMARY_ITEM_SELECT)
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return {
    ok: true,
    data: ((data ?? []) as unknown as RawListRow[]).map(normalizeListItem),
  };
}

export async function listBudgetItems(
  weddingId: string,
  filters: BudgetServerFilters,
  offset = 0,
  signal?: AbortSignal,
): Promise<BudgetResult<BudgetItemListPage>> {
  let query = supabase
    .from('budget_items')
    .select(BUDGET_ITEM_LIST_SELECT)
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + BUDGET_PAGE_SIZE);

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  const term = escapeIlike(filters.query);
  if (term) {
    query = query.or(`label.ilike.%${term}%,notes.ilike.%${term}%`);
  }
  if (signal) query = query.abortSignal(signal);

  const { data, error } = await query;
  if (error) return fail(error);
  const rows = ((data ?? []) as unknown as RawListRow[]).map(normalizeListItem);
  const hasMore = rows.length > BUDGET_PAGE_SIZE;
  return {
    ok: true,
    data: { items: hasMore ? rows.slice(0, BUDGET_PAGE_SIZE) : rows, hasMore },
  };
}

export async function getBudgetItem(
  weddingId: string,
  itemId: string,
  signal?: AbortSignal,
): Promise<BudgetResult<BudgetItemWithRelations>> {
  let query = supabase
    .from('budget_items')
    .select(BUDGET_ITEM_DETAIL_SELECT)
    .eq('id', itemId)
    .eq('wedding_id', weddingId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Expense not found or unavailable.');

  const row = data as unknown as {
    category: EmbedOne<{ id: string; slug: string; name_en: string }>;
    payments: ExpensePayment[] | null;
    wedding_vendor: EmbedOne<{
      id: string;
      status: string;
      vendor: EmbedOne<{ id: string; business_name: string }>;
    }>;
  } & BudgetItemWithRelations;

  const vendor = one(row.wedding_vendor);
  return {
    ok: true,
    data: {
      ...row,
      estimated_amount: Number(row.estimated_amount),
      committed_amount: row.committed_amount != null ? Number(row.committed_amount) : null,
      category: one(row.category),
      payments: (row.payments ?? []).map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
      wedding_vendor: vendor
        ? { id: vendor.id, status: vendor.status, vendor: one(vendor.vendor) }
        : null,
    },
  };
}

export async function createBudgetItem(
  weddingId: string,
  input: BudgetItemInput,
): Promise<BudgetResult<BudgetItemListItem>> {
  const { data, error } = await supabase
    .from('budget_items')
    .insert({
      wedding_id: weddingId,
      label: input.label.trim(),
      category_id: input.categoryId || null,
      estimated_amount: clampMoney(input.estimatedAmount),
      committed_amount:
        input.committedAmount == null || input.committedAmount === undefined
          ? null
          : clampMoney(input.committedAmount),
      notes: input.notes?.trim() || null,
      wedding_vendor_id: input.weddingVendorId || null,
      booking_id: input.bookingId || null,
    })
    .select(BUDGET_ITEM_LIST_SELECT)
    .single();
  if (error) return fail(error);
  return { ok: true, data: normalizeListItem(data as unknown as RawListRow) };
}

export async function updateBudgetItem(
  weddingId: string,
  itemId: string,
  input: BudgetItemInput,
): Promise<BudgetResult<BudgetItemListItem>> {
  const { data, error } = await supabase
    .from('budget_items')
    .update({
      label: input.label.trim(),
      category_id: input.categoryId || null,
      estimated_amount: clampMoney(input.estimatedAmount),
      committed_amount:
        input.committedAmount == null || input.committedAmount === undefined
          ? null
          : clampMoney(input.committedAmount),
      notes: input.notes?.trim() || null,
      wedding_vendor_id: input.weddingVendorId || null,
      booking_id: input.bookingId || null,
    })
    .eq('id', itemId)
    .eq('wedding_id', weddingId)
    .select(BUDGET_ITEM_LIST_SELECT)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) return notFound('Expense not found or unavailable.');
  return { ok: true, data: normalizeListItem(data as unknown as RawListRow) };
}

export async function deleteBudgetItem(
  weddingId: string,
  itemId: string,
): Promise<BudgetResult<true>> {
  const { data, error } = await supabase
    .from('budget_items')
    .delete()
    .eq('id', itemId)
    .eq('wedding_id', weddingId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return notFound('Expense not found or unavailable.');
  return { ok: true, data: true };
}

// --- Payments --------------------------------------------------------------------------------

export async function listPayments(
  budgetItemId: string,
  signal?: AbortSignal,
): Promise<BudgetResult<ExpensePayment[]>> {
  let query = supabase
    .from('expense_payments')
    .select(PAYMENT_COLUMNS)
    .eq('budget_item_id', budgetItemId)
    .order('paid_at', { ascending: false })
    .order('id', { ascending: true });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);
  return {
    ok: true,
    data: (data ?? []).map((row) => ({ ...row, amount: Number(row.amount) })) as ExpensePayment[],
  };
}

export async function createPayment(
  weddingId: string,
  budgetItemId: string,
  input: PaymentInput,
  recordedBy: string,
): Promise<BudgetResult<ExpensePayment>> {
  const itemResult = await getBudgetItem(weddingId, budgetItemId);
  if (!itemResult.ok) return itemResult;

  const due = itemDueAmount(itemResult.data);
  const paid = sumPayments(itemResult.data.payments);
  const amount = clampMoney(input.amount);

  if (!canRecordPayment(due, paid, amount)) {
    return fail({ code: 'overpayment', message: 'overpayment' });
  }

  const { data, error } = await supabase
    .from('expense_payments')
    .insert({
      budget_item_id: budgetItemId,
      amount,
      paid_at: input.paidAt,
      payment_method: input.paymentMethod ?? null,
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
      recorded_by: recordedBy,
    })
    .select(PAYMENT_COLUMNS)
    .single();
  if (error) return fail(error);
  return { ok: true, data: { ...data, amount: Number(data.amount) } as ExpensePayment };
}

export async function deletePayment(
  weddingId: string,
  budgetItemId: string,
  paymentId: string,
): Promise<BudgetResult<true>> {
  // Confirm the item belongs to this wedding before deleting the payment.
  const item = await supabase
    .from('budget_items')
    .select('id')
    .eq('id', budgetItemId)
    .eq('wedding_id', weddingId)
    .maybeSingle();
  if (item.error) return fail(item.error);
  if (!item.data) return notFound('Expense not found or unavailable.');

  const { data, error } = await supabase
    .from('expense_payments')
    .delete()
    .eq('id', paymentId)
    .eq('budget_item_id', budgetItemId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return notFound('Payment not found or unavailable.');
  return { ok: true, data: true };
}

// --- Vendor options --------------------------------------------------------------------------

export async function listWeddingVendorOptions(
  weddingId: string,
  signal?: AbortSignal,
): Promise<BudgetResult<WeddingVendorOption[]>> {
  let query = supabase
    .from('wedding_vendors')
    .select('id, status, vendor:vendors ( id, business_name )')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error) return fail(error);

  const options: WeddingVendorOption[] = [];
  for (const row of data ?? []) {
    const vendor = one(
      row.vendor as EmbedOne<{ id: string; business_name: string }>,
    );
    options.push({
      id: row.id,
      status: row.status,
      businessName: vendor?.business_name ?? 'Saved vendor',
    });
  }
  return { ok: true, data: options };
}

export type { BudgetUserMessage };
