export type VendorUserMessage = {
  code: string;
  message: string;
};

export function mapVendorError(
  error: { message?: string; code?: string } | Error | null,
): VendorUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501') {
    return {
      code: 'forbidden',
      message: 'You do not have permission for this vendor action.',
    };
  }
  if (message.includes('duplicate') || code === '23505') {
    return {
      code: 'duplicate',
      message: 'This vendor is already saved for your wedding.',
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
    message: 'Could not complete the vendor request. Please try again.',
  };
}
