import { describe, expect, it } from 'vitest';

import { resolveAppHomeDestination } from './resolveAppHomeDestination';

describe('resolveAppHomeDestination', () => {
  it('opens the single wedding dashboard', () => {
    expect(
      resolveAppHomeDestination({
        membershipCount: 1,
        singleWeddingId: 'w1',
        pendingInviteCount: 0,
      }),
    ).toEqual({ type: 'wedding', weddingId: 'w1' });
  });

  it('keeps the chooser when the user has multiple weddings', () => {
    expect(
      resolveAppHomeDestination({
        membershipCount: 3,
        singleWeddingId: null,
        pendingInviteCount: 2,
      }),
    ).toEqual({ type: 'stay-chooser', count: 3 });
  });

  it('sends zero-wedding users with pending invites to the selector inbox', () => {
    expect(
      resolveAppHomeDestination({
        membershipCount: 0,
        singleWeddingId: null,
        pendingInviteCount: 1,
      }),
    ).toEqual({ type: 'selector' });
  });

  it('sends zero-wedding users straight into create/onboarding', () => {
    expect(
      resolveAppHomeDestination({
        membershipCount: 0,
        singleWeddingId: null,
        pendingInviteCount: 0,
      }),
    ).toEqual({ type: 'create' });
  });

  it('resumes a vendor action started on Explore before anything else', () => {
    for (const membershipCount of [0, 1, 3]) {
      expect(
        resolveAppHomeDestination({
          membershipCount,
          singleWeddingId: membershipCount === 1 ? 'w1' : null,
          pendingInviteCount: 1,
          hasPendingVendorAction: true,
        }),
      ).toEqual({ type: 'vendor-action' });
    }
  });
});
