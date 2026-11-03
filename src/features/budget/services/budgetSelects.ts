/** Explicit column lists — never `*`. */

export const BUDGET_CATEGORY_COLUMNS = 'id, slug, name_en, name_am';

export const WEDDING_BUDGET_COLUMNS = 'wedding_id, total_budget, currency_code, updated_at';

export const BUDGET_ITEM_COLUMNS =
  'id, wedding_id, category_id, wedding_vendor_id, booking_id, label, estimated_amount, committed_amount, notes, created_at';

export const BUDGET_ITEM_LIST_SELECT = `${BUDGET_ITEM_COLUMNS},
  category:budget_categories ( id, slug, name_en ),
  payments:expense_payments ( id, amount, paid_at, payment_method, reference )`;

export const BUDGET_ITEM_DETAIL_SELECT = `${BUDGET_ITEM_COLUMNS},
  category:budget_categories ( id, slug, name_en ),
  payments:expense_payments ( id, amount, paid_at, payment_method, reference, notes, recorded_by ),
  wedding_vendor:wedding_vendors (
    id, status,
    vendor:vendors ( id, business_name )
  )`;

export const PAYMENT_COLUMNS =
  'id, budget_item_id, amount, paid_at, payment_method, reference, receipt_storage_path, notes, recorded_by';

export const BUDGET_SUMMARY_ITEM_SELECT = `${BUDGET_ITEM_COLUMNS},
  category:budget_categories ( id, slug, name_en ),
  payments:expense_payments ( id, amount )`;
