import type { GuestGroupCapability, PermissionKey } from '@/features/team/permissions';
import type { WeddingAccess } from '@/features/team/types';

export function accessCan(access: WeddingAccess | null | undefined, permission: PermissionKey): boolean {
  if (!access) return false;
  if (access.is_owner) return true;
  return access.permissions.includes(permission);
}

export function accessCanInGroup(
  access: WeddingAccess | null | undefined,
  groupId: string | null | undefined,
  capability: GuestGroupCapability,
): boolean {
  if (!access) return false;
  if (access.is_owner) return true;

  const weddingWide: Record<GuestGroupCapability, PermissionKey> = {
    view: 'guests.view',
    create: 'guests.create',
    update: 'guests.update',
    delete: 'guests.delete',
    send_invitations: 'guests.send_invitations',
  };
  if (accessCan(access, weddingWide[capability])) return true;
  if (!groupId) return false;

  const assignment = access.coordinated_groups.find((group) => group.group_id === groupId);
  if (!assignment) return false;
  if (capability === 'delete') return assignment.can_delete;
  if (capability === 'send_invitations') return assignment.can_send_invitations;
  return true;
}

/**
 * UI write hint derived from effective permissions.
 * Prefer feature-specific `can(...)` checks; this is the blunt control used by older screens.
 */
export function legacyCanWrite(access: WeddingAccess | null | undefined): boolean {
  if (!access) return false;
  if (access.is_owner) return true;
  return access.permissions.some(
    (permission) =>
      permission.endsWith('.create')
      || permission.endsWith('.update')
      || permission.endsWith('.delete')
      || permission.endsWith('.manage')
      || permission.endsWith('.assign')
      || permission.endsWith('.comment')
      || permission === 'guests.send_invitations'
      || permission === 'vendors.inquiries.manage',
  );
}
