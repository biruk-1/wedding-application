import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();

vi.mock('@/lib/authStorage', () => ({
  authStorage: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

import {
  clearPendingVendorAction,
  loadPendingVendorAction,
  parsePendingVendorAction,
  peekPendingVendorAction,
  savePendingVendorAction,
} from '@/features/vendors/services/pendingVendorAction';

const vendorId = '22222222-2222-4222-8222-222222222221';
const serviceId = 'b10229e5-ad59-4d09-93f6-314b5ae4ba19';

describe('pendingVendorAction', () => {
  beforeEach(async () => {
    memory.clear();
    await clearPendingVendorAction();
  });

  it('keeps the action, vendor and service across sign-in', async () => {
    await savePendingVendorAction({ kind: 'inquire', vendorId, vendorName: 'Lumen', serviceId });
    expect(peekPendingVendorAction()).toMatchObject({ kind: 'inquire', vendorId, serviceId });
    expect(await loadPendingVendorAction()).toMatchObject({ kind: 'inquire', vendorId, serviceId });
  });

  it('is gone once cleared, so it cannot run twice', async () => {
    await savePendingVendorAction({ kind: 'save', vendorId, vendorName: 'Lumen', serviceId: null });
    await clearPendingVendorAction();
    expect(peekPendingVendorAction()).toBeNull();
    expect(await loadPendingVendorAction()).toBeNull();
  });

  it('rejects stale, malformed, or tampered records', () => {
    const now = Date.now();
    const valid = { kind: 'save', vendorId, vendorName: 'x', serviceId: null, savedAt: now };
    expect(parsePendingVendorAction(JSON.stringify(valid), now)).not.toBeNull();
    expect(
      parsePendingVendorAction(JSON.stringify({ ...valid, savedAt: now - 25 * 60 * 60_000 }), now),
    ).toBeNull();
    expect(parsePendingVendorAction(JSON.stringify({ ...valid, kind: 'book' }), now)).toBeNull();
    expect(
      parsePendingVendorAction(JSON.stringify({ ...valid, vendorId: '../../etc' }), now),
    ).toBeNull();
    expect(parsePendingVendorAction('not json', now)).toBeNull();
    expect(
      parsePendingVendorAction(JSON.stringify({ ...valid, serviceId: 'x?y=1' }), now)?.serviceId,
    ).toBeNull();
  });
});
