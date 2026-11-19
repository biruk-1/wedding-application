import { PERMISSIONS, RESERVED_PERMISSIONS, type PermissionKey } from '@/features/team/permissions';

export type PermissionCategoryId =
  | 'team'
  | 'guests'
  | 'tasks'
  | 'vendors'
  | 'budget'
  | 'timeline'
  | 'documents'
  | 'activity';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'team.view': 'See the planning team',
  'team.invite': 'Invite collaborators',
  'team.members.manage': 'Remove members',
  'team.permissions.manage': 'Edit permissions',
  'wedding.settings.manage': 'Change wedding settings',
  'activity.view': 'See activity history',
  'guests.view': 'See guests',
  'guests.contacts.view': 'See guest contact details',
  'guests.create': 'Add guests',
  'guests.update': 'Edit guests',
  'guests.delete': 'Delete guests',
  'guests.manage_all': 'Manage all guest groups & seating',
  'guests.send_invitations': 'Send guest invitations',
  'tasks.view': 'See tasks',
  'tasks.create': 'Create tasks',
  'tasks.update': 'Edit tasks',
  'tasks.assign': 'Assign tasks',
  'tasks.comment': 'Comment on tasks',
  'tasks.delete': 'Delete tasks',
  'vendors.view': 'See vendors',
  'vendors.manage': 'Manage vendors',
  'vendors.inquiries.manage': 'Manage vendor inquiries',
  'budget.view': 'See budget totals',
  'budget.expenses.view': 'See expense lines',
  'budget.payments.view': 'See payments',
  'budget.expenses.create': 'Add expenses',
  'budget.expenses.update': 'Edit expenses',
  'budget.expenses.delete': 'Delete expenses',
  'budget.manage': 'Manage budget allocations',
  'timeline.view': 'See timeline',
  'timeline.manage': 'Manage timeline',
  'documents.view': 'See documents',
  'documents.manage': 'Manage documents',
};

export const PERMISSION_CATEGORIES: {
  id: PermissionCategoryId;
  title: string;
  description?: string;
  financial?: boolean;
  keys: PermissionKey[];
}[] = [
  {
    id: 'team',
    title: 'Team',
    keys: ['team.view', 'activity.view'],
  },
  {
    id: 'guests',
    title: 'Guests',
    keys: [
      'guests.view',
      'guests.contacts.view',
      'guests.create',
      'guests.update',
      'guests.delete',
      'guests.send_invitations',
      'guests.manage_all',
    ],
  },
  {
    id: 'tasks',
    title: 'Tasks',
    keys: [
      'tasks.view',
      'tasks.create',
      'tasks.update',
      'tasks.assign',
      'tasks.comment',
      'tasks.delete',
    ],
  },
  {
    id: 'vendors',
    title: 'Vendors',
    keys: ['vendors.view', 'vendors.manage', 'vendors.inquiries.manage'],
  },
  {
    id: 'budget',
    title: 'Budget',
    description: 'Financial access is off unless you grant it.',
    financial: true,
    keys: [
      'budget.view',
      'budget.expenses.view',
      'budget.payments.view',
      'budget.expenses.create',
      'budget.expenses.update',
      'budget.expenses.delete',
      'budget.manage',
    ],
  },
  {
    id: 'timeline',
    title: 'Timeline',
    keys: ['timeline.view', 'timeline.manage'],
  },
  {
    id: 'documents',
    title: 'Documents',
    keys: ['documents.view', 'documents.manage'],
  },
];

const RESERVED = new Set<string>(RESERVED_PERMISSIONS);

/** Permissions owners may grant to non-owners in the editor. */
export const GRANTABLE_PERMISSIONS: PermissionKey[] = PERMISSIONS.filter((key) => !RESERVED.has(key));

export const INVITE_ROLE_TEMPLATES = [
  'co_host',
  'planner',
  'family_coordinator',
  'task_manager',
  'collaborator',
  'viewer',
  'custom',
] as const;

export type InviteRoleTemplate = (typeof INVITE_ROLE_TEMPLATES)[number];

export const ROLE_TEMPLATE_DESCRIPTIONS: Record<InviteRoleTemplate, string> = {
  co_host: 'Broad planning access without budget or ownership.',
  planner: 'Full guest, task, vendor, and timeline access.',
  family_coordinator: 'Sees the team and can manage assigned guest groups.',
  task_manager: 'Owns the checklist and related vendor/timeline views.',
  collaborator: 'Wide access matching pre-team collaborators (no reserved owner powers).',
  viewer: 'Read-only look at tasks, vendors, and the timeline.',
  custom: 'Starts with team visibility only — set permissions after they join.',
};
