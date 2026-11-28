import { transportErrorCode } from '@/lib/query/queryError';

export type BookingUserMessage = {
  code: string;
  message: string;
};

export function mapBookingError(
  error: { message?: string; code?: string } | Error | null,
): BookingUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const transport = transportErrorCode(error);
  if (transport === 'timeout') {
    return { code: 'timeout', message: 'Request timed out. Please try again.' };
  }
  if (transport === 'network') {
    return { code: 'network', message: 'Network error. Check your connection and try again.' };
  }

  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
  const raw = ('message' in error ? error.message : '') ?? '';

  if (message.includes('only sent quotes')) {
    return { code: 'quote_not_open', message: 'This quote is no longer available to accept.' };
  }
  if (message.includes('wedding permission') || message.includes('permission')) {
    return {
      code: 'forbidden',
      message: 'You do not have permission for this booking action.',
    };
  }
  if (message.includes('row-level security') || code === '42501') {
    return {
      code: 'forbidden',
      message: 'You do not have permission for this booking action.',
    };
  }
  if (message.includes('already fully paid') || message.includes('nothing left to pay')) {
    return { code: 'already_paid', message: 'This booking is already paid.' };
  }
  if (message.includes('chapa') || message.includes('checkout')) {
    return {
      code: 'payment_gateway',
      message: raw || 'Could not start payment. Please try again.',
    };
  }

  return {
    code,
    message: raw && raw.length < 160 ? raw : 'Could not complete the booking request. Please try again.',
  };
}
