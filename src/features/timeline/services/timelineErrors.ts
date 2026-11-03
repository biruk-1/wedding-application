import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';

export type TimelineUserMessage = {
  code: string;
  message: string;
};

export function mapTimelineError(
  error: { message?: string; code?: string } | Error | null,
): TimelineUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = (('message' in error ? error.message : '') ?? '').toLowerCase();
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501') {
    return {
      code: 'forbidden',
      message: 'You do not have permission to change the schedule for this wedding.',
    };
  }
  if (message.includes('ends_at') || message.includes('check') || code === '23514') {
    return {
      code: 'invalid_times',
      message: 'The end time must be on or after the start time.',
    };
  }
  const transport = transportErrorCode(error);
  if (transport) {
    return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  }
  return {
    code,
    message: 'Could not update the schedule. Please try again.',
  };
}
