import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';

export type GuestUserMessage = {
  code: string;
  message: string;
};

type ErrorLike = { message?: string; code?: string; name?: string } | Error | null;

function lower(error: NonNullable<ErrorLike>): string {
  return (('message' in error ? error.message : '') ?? '').toLowerCase();
}

/**
 * Maps Postgres / PostgREST / RPC errors to messages safe to show users.
 * Raw database text (which can name constraints or tables) is never surfaced.
 */
export function mapGuestError(error: ErrorLike, fallback?: string): GuestUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = lower(error);
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('row-level security') || code === '42501' || message.includes('not authorized')) {
    return {
      code: 'forbidden',
      message: 'You do not have permission to change guests or invitations for this wedding.',
    };
  }
  if (message.includes('authentication required')) {
    return { code: 'unauthenticated', message: 'Please sign in again.' };
  }

  // Invitation RPC exceptions (raised as P0001 with a fixed message).
  if (message.includes('invalid invitation token')) {
    return { code: 'invalid_token', message: 'This invitation link is not valid.' };
  }
  if (message.includes('invitation has been cancelled') || message.includes('invitation is cancelled')) {
    return { code: 'cancelled', message: 'This invitation has been cancelled.' };
  }
  if (message.includes('not part of this invitation')) {
    return {
      code: 'not_in_invitation',
      message: 'That guest or event is not part of this invitation.',
    };
  }
  if (message.includes('does not belong to this wedding')) {
    return {
      code: 'wrong_wedding',
      message: 'One of the selected items does not belong to this wedding.',
    };
  }
  if (message.includes('guest_id or group_id is required')) {
    return { code: 'validation', message: 'Choose a guest or a group to invite.' };
  }
  if (message.includes('invalid response') || message.includes('invalid delivery_channel')) {
    return { code: 'validation', message: 'That value is not allowed.' };
  }
  if (message.includes('invitation not found')) {
    return { code: 'not_found', message: 'Invitation not found or unavailable.' };
  }

  if (code === '23505' || message.includes('duplicate key')) {
    if (message.includes('seating_assignments')) {
      return { code: 'duplicate', message: 'That seat is already taken at this table.' };
    }
    if (message.includes('seating_tables')) {
      return { code: 'duplicate', message: 'A table with this name already exists for this event.' };
    }
    return { code: 'duplicate', message: 'That entry already exists.' };
  }
  if (code === '23514') {
    return { code: 'validation', message: 'One of the values is not allowed. Please check the form.' };
  }
  if (code === '23503') {
    return {
      code: 'reference',
      message: 'This item is linked to something that was removed. Refresh and try again.',
    };
  }

  const transport = transportErrorCode(error);
  if (transport) {
    return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  }
  return {
    code,
    message: fallback ?? 'Could not complete that action. Please try again.',
  };
}
