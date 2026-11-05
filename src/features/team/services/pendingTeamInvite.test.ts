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
  clearPendingTeamInvite,
  hydratePendingTeamInvite,
  peekPendingTeamInvite,
  savePendingTeamInvite,
} from '@/features/team/services/pendingTeamInvite';

describe('pendingTeamInvite', () => {
  beforeEach(async () => {
    memory.clear();
    await clearPendingTeamInvite();
  });

  it('saves and loads a token', async () => {
    await savePendingTeamInvite(' abc123 ');
    expect(peekPendingTeamInvite()).toBe('abc123');
    expect(await hydratePendingTeamInvite()).toBe('abc123');
  });

  it('clears the token', async () => {
    await savePendingTeamInvite('token');
    await clearPendingTeamInvite();
    expect(peekPendingTeamInvite()).toBeNull();
    expect(await hydratePendingTeamInvite()).toBeNull();
  });
});
