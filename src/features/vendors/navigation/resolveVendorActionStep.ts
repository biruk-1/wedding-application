import type { PendingVendorAction } from '@/features/vendors/services/pendingVendorAction';

/**
 * Next step for a vendor action resumed after sign-in. Pure — unit-tested.
 * `requestedWeddingId` comes from the "celebration created" screen and wins when it is one of
 * the user's memberships.
 */
export type VendorActionStep =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'create-or-invites' }
  | { type: 'choose' }
  | { type: 'run'; weddingId: string };

export function resolveVendorActionStep(input: {
  hasAction: boolean;
  membershipIds: readonly string[];
  pendingInviteCount: number;
  requestedWeddingId?: string | null;
}): VendorActionStep {
  if (!input.hasAction) return { type: 'none' };
  const requested = input.requestedWeddingId?.trim();
  if (requested && input.membershipIds.includes(requested)) {
    return { type: 'run', weddingId: requested };
  }
  if (input.membershipIds.length === 1) return { type: 'run', weddingId: input.membershipIds[0]! };
  if (input.membershipIds.length > 1) return { type: 'choose' };
  return input.pendingInviteCount > 0 ? { type: 'create-or-invites' } : { type: 'create' };
}

/** In-app route that completes the action for one wedding. */
export function vendorActionHref(action: PendingVendorAction, weddingId: string): string {
  const base = `/(app)/weddings/${weddingId}/vendors/${action.vendorId}`;
  if (action.kind === 'inquire') {
    return action.serviceId ? `${base}/inquire?serviceId=${action.serviceId}` : `${base}/inquire`;
  }
  return base;
}
