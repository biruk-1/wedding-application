import type { Database } from '@/types/database.types';

export type BudgetCategory = Database['public']['Tables']['budget_categories']['Row'];
export type WeddingBudget = Database['public']['Tables']['wedding_budgets']['Row'];
export type BudgetItem = Database['public']['Tables']['budget_items']['Row'];
export type ExpensePayment = Database['public']['Tables']['expense_payments']['Row'];

export type PaymentMethod = NonNullable<ExpensePayment['payment_method']>;

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'telebirr',
  'chapa',
  'card',
  'other',
] as const satisfies readonly PaymentMethod[];

/** Derived from payments vs the item's due amount — not a DB column. */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type BudgetItemWithRelations = BudgetItem & {
  category: Pick<BudgetCategory, 'id' | 'slug' | 'name_en'> | null;
  payments: Pick<ExpensePayment, 'id' | 'amount' | 'paid_at' | 'payment_method' | 'reference'>[];
  wedding_vendor: { id: string; status: string; vendor: { id: string; business_name: string } | null } | null;
};

export type BudgetItemListItem = BudgetItem & {
  category: Pick<BudgetCategory, 'id' | 'slug' | 'name_en'> | null;
  paid_total: number;
  due_amount: number;
  outstanding: number;
  payment_status: PaymentStatus;
};

export type BudgetItemInput = {
  label: string;
  categoryId?: string | null;
  estimatedAmount: number;
  committedAmount?: number | null;
  notes?: string | null;
  weddingVendorId?: string | null;
  bookingId?: string | null;
};

export type PaymentInput = {
  amount: number;
  paidAt: string;
  paymentMethod?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
};

export type WeddingBudgetUpdate = {
  totalBudget: number;
  currencyCode?: string;
};

export type BudgetServerFilters = {
  query: string;
  categoryId: string | null;
};

export type WeddingVendorOption = {
  id: string;
  status: string;
  businessName: string;
};

/**
 * Dashboard totals. Definitions (schema-faithful):
 * - totalBudget: wedding_budgets.total_budget
 * - allocated: sum(budget_items.estimated_amount) — planned
 * - actual: sum(coalesce(committed_amount, 0)) — confirmed spend only
 * - paid: sum(expense_payments.amount)
 * - outstanding: sum(max(0, due - paid)) where due = committed ?? estimated
 * - remaining: totalBudget - actual
 * - utilization: actual / totalBudget (0 when total is 0)
 */
export type BudgetSummary = {
  totalBudget: number;
  allocated: number;
  actual: number;
  paid: number;
  outstanding: number;
  remaining: number;
  utilization: number;
  currencyCode: string;
  itemCount: number;
  overBudget: boolean;
};

export type CategoryBreakdown = {
  categoryId: string | null;
  slug: string | null;
  name: string;
  allocated: number;
  actual: number;
  paid: number;
  outstanding: number;
  overAllocated: boolean;
};

export type BudgetItemListPage = {
  items: BudgetItemListItem[];
  hasMore: boolean;
};
