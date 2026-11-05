/**
 * Permission keys mirrored from `wedding_permission_catalog`.
 * Owners hold every key implicitly; non-owners store rows in `wedding_member_permissions`.
 */
export const PERMISSIONS = [
  'team.view',
  'team.invite',
  'team.members.manage',
  'team.permissions.manage',
  'wedding.settings.manage',
  'activity.view',
  'guests.view',
  'guests.contacts.view',
  'guests.create',
  'guests.update',
  'guests.delete',
  'guests.manage_all',
  'guests.send_invitations',
  'tasks.view',
  'tasks.create',
  'tasks.update',
  'tasks.assign',
  'tasks.comment',
  'tasks.delete',
  'vendors.view',
  'vendors.manage',
  'vendors.inquiries.manage',
  'budget.view',
  'budget.expenses.view',
  'budget.payments.view',
  'budget.expenses.create',
  'budget.expenses.update',
  'budget.expenses.delete',
  'budget.manage',
  'timeline.view',
  'timeline.manage',
  'documents.view',
  'documents.manage',
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const RESERVED_PERMISSIONS = [
  'team.invite',
  'team.members.manage',
  'team.permissions.manage',
  'wedding.settings.manage',
] as const satisfies readonly PermissionKey[];

export type GuestGroupCapability =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'send_invitations';

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSIONS as readonly string[]).includes(value);
}
