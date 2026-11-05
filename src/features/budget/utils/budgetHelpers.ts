import type {
  BudgetItem,
  BudgetItemListItem,
  BudgetSummary,
  CategoryBreakdown,
  ExpensePayment,
  PaymentStatus,
  WeddingBudget,
} from '@/features/budget/types';
import { addMoney, formatPercent, fromMinor, moneyGreater, subMoney, toMinor } from '@/features/budget/utils/money';

type AmountRow = Pick<BudgetItem, 'estimated_amount' | 'committed_amount'>;
type PaymentRow = Pick<ExpensePayment, 'budget_item_id' | 'amount'>;

/** Amount payments are measured against for an item. */
export function itemDueAmount(item: AmountRow): number {
  return item.committed_amount != null ? Number(item.committed_amount) : Number(item.estimated_amount);
}

export function itemActualAmount(item: AmountRow): number {
  return item.committed_amount != null ? Number(item.committed_amount) : 0;
}

export function itemPlannedAmount(item: AmountRow): number {
  return Number(item.estimated_amount) || 0;
}

export function sumPayments(payments: Pick<ExpensePayment, 'amount'>[]): number {
  return payments.reduce((sum, payment) => addMoney(sum, Number(payment.amount) || 0), 0);
}

export function paymentStatus(due: number, paid: number): PaymentStatus {
  if (toMinor(paid) <= 0) return 'unpaid';
  if (toMinor(paid) >= toMinor(due)) return 'paid';
  return 'partial';
}

export function itemOutstanding(due: number, paid: number): number {
  const left = subMoney(due, paid);
  return left > 0 ? left : 0;
}

export function enrichBudgetItem(
  item: BudgetItem & {
    category?: { id: string; slug: string; name_en: string } | null;
    payments?: Pick<ExpensePayment, 'id' | 'amount' | 'paid_at' | 'payment_method' | 'reference'>[] | null;
  },
): BudgetItemListItem {
  const payments = item.payments ?? [];
  const paid = sumPayments(payments);
  const due = itemDueAmount(item);
  return {
    id: item.id,
    wedding_id: item.wedding_id,
    category_id: item.category_id,
    wedding_vendor_id: item.wedding_vendor_id,
    booking_id: item.booking_id,
    label: item.label,
    estimated_amount: Number(item.estimated_amount),
    committed_amount: item.committed_amount != null ? Number(item.committed_amount) : null,
    notes: item.notes,
    created_at: item.created_at,
    item_kind: item.item_kind,
    category: item.category ?? null,
    paid_total: paid,
    due_amount: due,
    outstanding: itemOutstanding(due, paid),
    payment_status: paymentStatus(due, paid),
  };
}

export function computeBudgetSummary(
  budget: Pick<WeddingBudget, 'total_budget' | 'currency_code'> | null | undefined,
  items: (AmountRow & { id: string })[],
  payments: PaymentRow[],
): BudgetSummary {
  const totalBudget = Number(budget?.total_budget ?? 0);
  const currencyCode = budget?.currency_code ?? 'ETB';
  const allocated = items.reduce((sum, item) => addMoney(sum, itemPlannedAmount(item)), 0);
  const actual = items.reduce((sum, item) => addMoney(sum, itemActualAmount(item)), 0);
  const paid = payments.reduce((sum, payment) => addMoney(sum, Number(payment.amount) || 0), 0);

  const paidByItem = new Map<string, number>();
  for (const payment of payments) {
    paidByItem.set(
      payment.budget_item_id,
      addMoney(paidByItem.get(payment.budget_item_id) ?? 0, Number(payment.amount) || 0),
    );
  }

  let outstanding = 0;
  for (const item of items) {
    outstanding = addMoney(
      outstanding,
      itemOutstanding(itemDueAmount(item), paidByItem.get(item.id) ?? 0),
    );
  }

  const remaining = subMoney(totalBudget, actual);
  const utilization = totalBudget > 0 ? toMinor(actual) / toMinor(totalBudget) : 0;

  return {
    totalBudget,
    allocated,
    actual,
    paid,
    outstanding,
    remaining,
    utilization,
    currencyCode,
    itemCount: items.length,
    overBudget: moneyGreater(actual, totalBudget) && totalBudget > 0,
  };
}

export function buildCategoryBreakdown(
  items: (AmountRow & {
    id?: string;
    category_id: string | null;
    category?: { id: string; slug: string; name_en: string } | null;
  })[],
  payments: PaymentRow[],
): CategoryBreakdown[] {
  const paidByItem = new Map<string, number>();
  for (const payment of payments) {
    paidByItem.set(
      payment.budget_item_id,
      addMoney(paidByItem.get(payment.budget_item_id) ?? 0, Number(payment.amount) || 0),
    );
  }

  type Acc = {
    categoryId: string | null;
    slug: string | null;
    name: string;
    allocatedMinor: number;
    actualMinor: number;
    paidMinor: number;
    outstandingMinor: number;
  };

  const map = new Map<string, Acc>();

  for (const item of items) {
    const key = item.category_id ?? 'uncategorized';
    const existing = map.get(key) ?? {
      categoryId: item.category_id,
      slug: item.category?.slug ?? null,
      name: item.category?.name_en ?? 'Uncategorized',
      allocatedMinor: 0,
      actualMinor: 0,
      paidMinor: 0,
      outstandingMinor: 0,
    };

    const paid = item.id ? (paidByItem.get(item.id) ?? 0) : 0;
    existing.allocatedMinor += toMinor(itemPlannedAmount(item));
    existing.actualMinor += toMinor(itemActualAmount(item));
    existing.paidMinor += toMinor(paid);
    existing.outstandingMinor += toMinor(itemOutstanding(itemDueAmount(item), paid));
    map.set(key, existing);
  }

  return [...map.values()]
    .map((row) => {
      const allocated = fromMinor(row.allocatedMinor);
      const actual = fromMinor(row.actualMinor);
      return {
        categoryId: row.categoryId,
        slug: row.slug,
        name: row.name,
        allocated,
        actual,
        paid: fromMinor(row.paidMinor),
        outstanding: fromMinor(row.outstandingMinor),
        overAllocated: moneyGreater(actual, allocated) && allocated > 0,
      };
    })
    .sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name));
}

export function canRecordPayment(due: number, alreadyPaid: number, nextPayment: number): boolean {
  if (nextPayment <= 0) return false;
  return toMinor(nextPayment) <= toMinor(itemOutstanding(due, alreadyPaid));
}

export function utilizationLabel(summary: BudgetSummary): string {
  return formatPercent(summary.utilization);
}

export function filterBudgetItems(
  items: BudgetItemListItem[],
  filters: { query: string; categoryId: string | null; paymentStatus?: PaymentStatus | 'all' },
): BudgetItemListItem[] {
  const q = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.categoryId && item.category_id !== filters.categoryId) return false;
    if (filters.paymentStatus && filters.paymentStatus !== 'all' && item.payment_status !== filters.paymentStatus) {
      return false;
    }
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      (item.category?.name_en.toLowerCase().includes(q) ?? false) ||
      (item.notes?.toLowerCase().includes(q) ?? false)
    );
  });
}
