export type ChecklistUserMessage = {
  code: string;
  message: string;
};

export function mapChecklistError(
  error: { message?: string; code?: string } | Error | null,
): ChecklistUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501') {
    return {
      code: 'forbidden',
      message: 'You do not have permission to change tasks for this wedding.',
    };
  }
  if (message.includes('network') || message.includes('fetch')) {
    return {
      code: 'network',
      message: 'Network error. Check your connection and try again.',
    };
  }
  return {
    code,
    message: 'Could not update the checklist. Please try again.',
  };
}
