import { describe, expect, it } from 'vitest';

import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';

describe('formatMemberRoleLabel', () => {
  it('labels known Planning Team roles', () => {
    expect(formatMemberRoleLabel('owner')).toBe('Owner');
    expect(formatMemberRoleLabel('co_host')).toBe('Co-host');
    expect(formatMemberRoleLabel('family_coordinator')).toBe('Family coordinator');
    expect(formatMemberRoleLabel('task_manager')).toBe('Task manager');
  });

  it('falls back safely for unknown or empty values', () => {
    expect(formatMemberRoleLabel(null)).toBe('Member');
    expect(formatMemberRoleLabel('special_guest')).toBe('special guest');
  });
});
