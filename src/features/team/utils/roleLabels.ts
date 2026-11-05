export const TEAM_ROLE_LABELS = {
  owner: 'Owner',
  partner: 'Partner',
  planner: 'Wedding planner',
  collaborator: 'Collaborator',
  viewer: 'Viewer',
  co_host: 'Co-host',
  family_coordinator: 'Family coordinator',
  task_manager: 'Task manager',
  custom: 'Custom',
} as const;

export type KnownTeamRole = keyof typeof TEAM_ROLE_LABELS;

/** Human-readable Planning Team role for badges and lists. */
export function formatMemberRoleLabel(role: string | null | undefined): string {
  if (!role) return 'Member';
  if (role in TEAM_ROLE_LABELS) {
    return TEAM_ROLE_LABELS[role as KnownTeamRole];
  }
  return role.replaceAll('_', ' ');
}
