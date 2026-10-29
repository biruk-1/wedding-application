export type WeddingUserMessage = {
  code: string;
  message: string;
};

export function mapWeddingError(error: { message?: string; code?: string } | Error | null): WeddingUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }

  const rawMessage = 'message' in error ? error.message : '';
  const message = (rawMessage ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';


  if (message.includes('authentication required') || code === 'PGRST301') {
    return { code: 'unauthenticated', message: 'Please sign in again to continue.' };
  }
  if (message.includes('title is required')) {
    return { code: 'title', message: 'Wedding title is required.' };
  }
  if (message.includes('partner_one_name')) {
    return { code: 'partner_one', message: 'Partner one name is required.' };
  }
  if (message.includes('partner_two_name')) {
    return { code: 'partner_two', message: 'Partner two name is required.' };
  }
  if (message.includes('network') || message.includes('fetch') || code === 'network') {
    return {
      code: 'network',
      message: 'Network error. Check your connection and that Supabase is running.',
    };
  }

  return {
    code,
    message: 'Could not complete that wedding action. Please try again.',
  };
}
