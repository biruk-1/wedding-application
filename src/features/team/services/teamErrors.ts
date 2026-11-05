import { TRANSPORT_MESSAGES, transportErrorCode } from '@/lib/query/queryError';

export type TeamUserMessage = {
  code: string;
  message: string;
};

type ErrorLike = { message?: string; code?: string } | Error | null;

function lower(error: NonNullable<ErrorLike>): string {
  return (('message' in error ? error.message : '') ?? '').toLowerCase();
}

/** Maps team RPC / PostgREST errors to messages safe to show users. */
export function mapTeamError(error: ErrorLike, fallback?: string): TeamUserMessage {
  if (!error) {
    return { code: 'unknown', message: 'Something went wrong. Please try again.' };
  }
  const message = lower(error);
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';

  if (message.includes('authentication required')) {
    return { code: 'unauthenticated', message: 'Please sign in again.' };
  }
  if (
    message.includes('not a member')
    || message.includes('row-level security')
    || code === '42501'
  ) {
    return {
      code: 'forbidden',
      message: "You don't have access to this wedding's planning team.",
    };
  }
  if (message.includes('only wedding owners can remove')) {
    return { code: 'forbidden', message: 'Only wedding owners can remove members.' };
  }
  if (message.includes('ownership can only change')) {
    return {
      code: 'ownership',
      message: 'Owners can only be changed through the ownership confirmation flow.',
    };
  }
  if (message.includes('only owner cannot leave')) {
    return {
      code: 'sole_owner',
      message: 'Add another owner before leaving, or transfer ownership first.',
    };
  }
  if (message.includes('leave_wedding')) {
    return { code: 'use_leave', message: 'Use Leave wedding to remove yourself.' };
  }
  if (message.includes('member not found')) {
    return { code: 'not_found', message: 'That person is not a member of this wedding.' };
  }
  if (message.includes('invalid invite token')) {
    return { code: 'invalid_token', message: 'This invite link is not valid.' };
  }
  if (message.includes('invite has been revoked')) {
    return { code: 'revoked', message: 'This invite was revoked by a wedding owner.' };
  }
  if (message.includes('invite has already been used')) {
    return { code: 'used', message: 'This invite has already been used.' };
  }
  if (message.includes('invite has expired')) {
    return { code: 'expired', message: 'This invite has expired. Ask an owner for a new link.' };
  }
  if (message.includes('different email address')) {
    return {
      code: 'wrong_account',
      message: 'This invite was sent to a different email address. Sign in with that account.',
    };
  }
  if (message.includes('confirm your email')) {
    return {
      code: 'unconfirmed',
      message: 'Confirm your email address before joining this wedding.',
    };
  }
  if (message.includes('already a member')) {
    return { code: 'already_member', message: 'You are already a member of this wedding.' };
  }
  if (message.includes('already has two owners') || message.includes('pending co-owner')) {
    return {
      code: 'owner_cap',
      message: 'This wedding already has two owners or a pending co-owner invite.',
    };
  }
  if (message.includes('pending invite already exists')) {
    return {
      code: 'duplicate_invite',
      message: 'A pending invite already exists for that email.',
    };
  }
  if (message.includes('only wedding owners can')) {
    return { code: 'forbidden', message: 'Only wedding owners can manage Planning Team invites.' };
  }
  if (message.includes('invited_email is required') || message.includes('not a valid email')) {
    return { code: 'validation', message: 'Enter a valid email address.' };
  }
  if (message.includes('between 1 hour and 30 days') || message.includes('invalid invite')) {
    return { code: 'validation', message: 'That invite option is not allowed.' };
  }

  const transport = transportErrorCode(error);
  if (transport) {
    return { code: transport, message: TRANSPORT_MESSAGES[transport] };
  }
  return {
    code,
    message: fallback ?? 'Could not complete that team action. Please try again.',
  };
}
