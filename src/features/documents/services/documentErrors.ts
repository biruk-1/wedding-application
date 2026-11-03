import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';

export type DocumentUserMessage = {
  code: string;
  message: string;
};

export function mapDocumentError(
  error: { message?: string; code?: string } | Error | null,
): DocumentUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong with this document.' };
  }
  const transport = transportErrorCode(error);
  if (transport) {
    return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  }

  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501' || message.includes('permission')) {
    return {
      code: 'forbidden',
      message: 'You do not have permission to manage this document.',
    };
  }
  if (message.includes('payload too large') || message.includes('maximum allowed size') || code === '413') {
    return { code: 'too_large', message: 'That file is too large. Use a file under 20 MB.' };
  }
  if (message.includes('mime') || message.includes('not allowed') || message.includes('unsupported')) {
    return { code: 'unsupported', message: 'That file type is not supported.' };
  }
  if (code === 'too_large' || code === 'unsupported' || code === 'validation' || code === 'not_found') {
    return {
      code,
      message: 'message' in error && error.message ? error.message : 'Something went wrong with this document.',
    };
  }

  return {
    code,
    message:
      'message' in error && typeof error.message === 'string' && error.message
        ? error.message
        : 'Something went wrong with this document.',
  };
}
