import type { TeamActivityItem } from '@/features/team/types';

/** Short human label for a wedding activity row. */
export function formatActivityAction(item: TeamActivityItem): string {
  switch (item.action) {
    case 'member.joined':
    case 'invite.accepted':
      return 'joined the planning team';
    case 'member.removed':
      return 'was removed from the team';
    case 'member.left':
      return 'left the wedding';
    case 'member.role_changed':
    case 'member.permissions_set':
      return 'had their access updated';
    case 'invite.created':
      return 'sent a team invite';
    case 'invite.revoked':
      return 'revoked a team invite';
    case 'invite.resent':
      return 'resent a team invite';
    case 'coordinator.assigned':
      return 'assigned a group coordinator';
    case 'coordinator.unassigned':
      return 'removed a group coordinator';
    case 'guest.created':
      return 'added a guest';
    case 'guest.updated':
      return 'updated a guest';
    case 'guest.deleted':
      return 'removed a guest';
    case 'task.created':
      return 'created a task';
    case 'task.updated':
      return 'updated a task';
    case 'task.assignees_set':
      return 'changed task assignees';
    case 'task.comment_added':
      return 'commented on a task';
    case 'task.comment_deleted':
      return 'removed a task comment';
    case 'task.deleted':
      return 'deleted a task';
    case 'wedding.settings_updated':
      return 'updated wedding settings';
    default:
      return item.action.replaceAll('.', ' ');
  }
}
