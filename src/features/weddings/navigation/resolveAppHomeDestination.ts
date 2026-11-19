/**
 * Where the authenticated hub (`/(app)`) should send the user once memberships
 * (and optional pending team invites) are known. Pure — unit-tested.
 */
export type AppHomeDestination =
  | { type: 'vendor-action' }
  | { type: 'wedding'; weddingId: string }
  | { type: 'selector' }
  | { type: 'create' }
  | { type: 'stay-chooser'; count: number };

export function resolveAppHomeDestination(input: {
  membershipCount: number;
  singleWeddingId: string | null;
  pendingInviteCount: number;
  /** A vendor action started on public Explore before sign-in. */
  hasPendingVendorAction?: boolean;
}): AppHomeDestination {
  const { membershipCount, singleWeddingId, pendingInviteCount } = input;

  if (input.hasPendingVendorAction) {
    return { type: 'vendor-action' };
  }

  if (membershipCount === 1 && singleWeddingId) {
    return { type: 'wedding', weddingId: singleWeddingId };
  }

  if (membershipCount > 1) {
    return { type: 'stay-chooser', count: membershipCount };
  }

  // Zero memberships: prefer accepting a pending collaborator invite over forcing create.
  if (pendingInviteCount > 0) {
    return { type: 'selector' };
  }

  return { type: 'create' };
}
