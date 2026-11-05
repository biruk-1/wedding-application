import { describe, expect, it } from 'vitest';

import {
  accessCan,
  accessCanInGroup,
  legacyCanWrite,
} from '@/features/team/utils/teamAccess';
import type { WeddingAccess } from '@/features/team/types';

function access(partial: Partial<WeddingAccess>): WeddingAccess {
  return {
    wedding_id: 'w1',
    role: 'collaborator',
    is_owner: false,
    permissions: [],
    coordinated_groups: [],
    ...partial,
  };
}

describe('team access helpers', () => {
  it('gives owners every permission', () => {
    const owner = access({ role: 'owner', is_owner: true });
    expect(accessCan(owner, 'budget.manage')).toBe(true);
    expect(accessCan(owner, 'team.invite')).toBe(true);
    expect(legacyCanWrite(owner)).toBe(true);
  });

  it('checks stored permissions for non-owners', () => {
    const member = access({ permissions: ['tasks.view', 'tasks.update'] });
    expect(accessCan(member, 'tasks.update')).toBe(true);
    expect(accessCan(member, 'budget.view')).toBe(false);
  });

  it('derives write UI from effective permissions', () => {
    expect(legacyCanWrite(access({ role: 'collaborator', permissions: [] }))).toBe(false);
    expect(
      legacyCanWrite(access({ role: 'collaborator', permissions: ['tasks.view', 'tasks.update'] })),
    ).toBe(true);
    expect(
      legacyCanWrite(access({ role: 'viewer', permissions: ['tasks.view', 'timeline.view'] })),
    ).toBe(false);
  });

  it('resolves group coordination flags', () => {
    const coordinator = access({
      role: 'family_coordinator',
      coordinated_groups: [
        { group_id: 'g1', can_delete: false, can_send_invitations: true },
      ],
    });
    expect(accessCanInGroup(coordinator, 'g1', 'view')).toBe(true);
    expect(accessCanInGroup(coordinator, 'g1', 'send_invitations')).toBe(true);
    expect(accessCanInGroup(coordinator, 'g1', 'delete')).toBe(false);
    expect(accessCanInGroup(coordinator, 'g2', 'view')).toBe(false);
    expect(accessCanInGroup(coordinator, null, 'view')).toBe(false);
  });
});
