import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';

export type BudgetUserMessage = {
  code: string;
  message: string;
};

export function mapBudgetError(
  error: { message?: string; code?: string } | Error | null,
): BudgetUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501') {
    return {
      code: 'forbidden',
      message: 'You do not have permission to change the budget for this wedding.',
    };
  }
  if (message.includes('check') || code === '23514') {
    return {
      code: 'invalid_amount',
      message: 'Amounts must be valid and within the allowed range.',
    };
  }
  if (code === '23503') {
    return {
      code: 'invalid_reference',
      message: 'A linked vendor, booking, or category is unavailable for this wedding.',
    };
  }
  if (code === 'overpayment' || message.includes('overpayment')) {
    return {
      code: 'overpayment',
      message: 'This payment would exceed the outstanding balance for the expense.',
    };
  }
  if (code === 'budget_missing' || message.includes('budget_missing')) {
    return {
      code: 'budget_missing',
      message: 'No budget exists for this wedding yet. Budgets are created when the wedding is created.',
    };
  }
  const transport = transportErrorCode(error);
  if (transport) {
    return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  }
  return {
    code,
    message: 'Could not update the budget. Please try again.',
  };
}
