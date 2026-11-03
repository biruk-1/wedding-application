import { z } from 'zod';

import { PAYMENT_METHODS } from '@/features/budget/types';
import { parseMoneyInput } from '@/features/budget/utils/money';

const moneyField = (label: string, { allowZero = true }: { allowZero?: boolean } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .superRefine((value, ctx) => {
      const parsed = parseMoneyInput(value);
      if (parsed == null) {
        ctx.addIssue({ code: 'custom', message: `Enter a valid ${label.toLowerCase()} (up to 2 decimals)` });
        return;
      }
      if (!allowZero && parsed <= 0) {
        ctx.addIssue({ code: 'custom', message: `${label} must be greater than zero` });
      }
    })
    .transform((value) => parseMoneyInput(value)!);

export const budgetTotalSchema = z.object({
  totalBudget: moneyField('Total budget', { allowZero: true }),
  currencyCode: z
    .string()
    .trim()
    .length(3, 'Use a 3-letter currency code')
    .transform((value) => value.toUpperCase())
    .default('ETB'),
});

export const expenseFormSchema = z.object({
  label: z.string().trim().min(1, 'Expense name is required').max(160, 'Name is too long'),
  categoryId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null)),
  estimatedAmount: moneyField('Planned amount', { allowZero: true }),
  committedAmount: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      return value;
    })
    .superRefine((value, ctx) => {
      if (value == null) return;
      const parsed = parseMoneyInput(value);
      if (parsed == null) {
        ctx.addIssue({ code: 'custom', message: 'Enter a valid actual amount (up to 2 decimals)' });
      }
    })
    .transform((value) => (value == null ? null : parseMoneyInput(value)!)),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes are too long')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  weddingVendorId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null)),
});

export const paymentFormSchema = z.object({
  amount: moneyField('Payment amount', { allowZero: false }),
  paidAt: z
    .string()
    .trim()
    .min(1, 'Payment date is required')
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: 'Use a valid date' }),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  reference: z
    .string()
    .trim()
    .max(120, 'Reference is too long')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  notes: z
    .string()
    .trim()
    .max(2000, 'Notes are too long')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type BudgetTotalValues = z.infer<typeof budgetTotalSchema>;
export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;
export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}
