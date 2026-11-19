import { describe, expect, it } from 'vitest';

import { resolveVendorActionStep, vendorActionHref } from './resolveVendorActionStep';

const vendorId = '22222222-2222-4222-8222-222222222221';
const serviceId = 'b10229e5-ad59-4d09-93f6-314b5ae4ba19';

describe('resolveVendorActionStep', () => {
  it('does nothing without a stored action', () => {
    expect(
      resolveVendorActionStep({ hasAction: false, membershipIds: ['w1'], pendingInviteCount: 0 }),
    ).toEqual({ type: 'none' });
  });

  it('sends users without a celebration to onboarding first', () => {
    expect(
      resolveVendorActionStep({ hasAction: true, membershipIds: [], pendingInviteCount: 0 }),
    ).toEqual({ type: 'create' });
  });

  it('offers invitations when a zero-celebration user has pending team invites', () => {
    expect(
      resolveVendorActionStep({ hasAction: true, membershipIds: [], pendingInviteCount: 2 }),
    ).toEqual({ type: 'create-or-invites' });
  });

  it('runs directly for a single celebration', () => {
    expect(
      resolveVendorActionStep({ hasAction: true, membershipIds: ['w1'], pendingInviteCount: 0 }),
    ).toEqual({ type: 'run', weddingId: 'w1' });
  });

  it('asks which celebration when there are several', () => {
    expect(
      resolveVendorActionStep({
        hasAction: true,
        membershipIds: ['w1', 'w2'],
        pendingInviteCount: 0,
      }),
    ).toEqual({ type: 'choose' });
  });

  it('uses the celebration just created, but only if the user belongs to it', () => {
    expect(
      resolveVendorActionStep({
        hasAction: true,
        membershipIds: ['w1', 'w2'],
        pendingInviteCount: 0,
        requestedWeddingId: 'w2',
      }),
    ).toEqual({ type: 'run', weddingId: 'w2' });
    expect(
      resolveVendorActionStep({
        hasAction: true,
        membershipIds: ['w1', 'w2'],
        pendingInviteCount: 0,
        requestedWeddingId: 'someone-elses',
      }),
    ).toEqual({ type: 'choose' });
  });
});

describe('vendorActionHref', () => {
  const base = { vendorId, vendorName: 'Lumen', savedAt: 0 };

  it('opens the inquiry form and keeps the chosen service', () => {
    expect(vendorActionHref({ ...base, kind: 'inquire', serviceId }, 'w1')).toBe(
      `/(app)/weddings/w1/vendors/${vendorId}/inquire?serviceId=${serviceId}`,
    );
    expect(vendorActionHref({ ...base, kind: 'inquire', serviceId: null }, 'w1')).toBe(
      `/(app)/weddings/w1/vendors/${vendorId}/inquire`,
    );
  });

  it('opens the in-app profile after saving', () => {
    expect(vendorActionHref({ ...base, kind: 'save', serviceId: null }, 'w1')).toBe(
      `/(app)/weddings/w1/vendors/${vendorId}`,
    );
  });
});
