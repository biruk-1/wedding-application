import { describe, expect, it } from 'vitest';

import {
  GRANTABLE_PERMISSIONS,
  INVITE_ROLE_TEMPLATES,
  PERMISSION_CATEGORIES,
  PERMISSION_LABELS,
} from '@/features/team/permissionLabels';
import { PERMISSIONS, RESERVED_PERMISSIONS } from '@/features/team/permissions';

describe('permissionLabels', () => {
  it('labels every catalog permission', () => {
    for (const key of PERMISSIONS) {
      expect(PERMISSION_LABELS[key]).toBeTruthy();
    }
  });

  it('excludes reserved keys from grantable editor list', () => {
    for (const key of RESERVED_PERMISSIONS) {
      expect(GRANTABLE_PERMISSIONS).not.toContain(key);
    }
    expect(GRANTABLE_PERMISSIONS.length).toBe(PERMISSIONS.length - RESERVED_PERMISSIONS.length);
  });

  it('keeps financial permissions in the budget category', () => {
    const budget = PERMISSION_CATEGORIES.find((category) => category.id === 'budget');
    expect(budget?.financial).toBe(true);
    expect(budget?.keys).toContain('budget.view');
    expect(budget?.keys).toContain('budget.manage');
  });

  it('offers invite templates without owner or partner', () => {
    expect(INVITE_ROLE_TEMPLATES).not.toContain('owner');
    expect(INVITE_ROLE_TEMPLATES).not.toContain('partner');
    expect(INVITE_ROLE_TEMPLATES).toContain('family_coordinator');
    expect(INVITE_ROLE_TEMPLATES).toContain('custom');
  });
});
