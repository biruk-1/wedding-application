import type { GuestGroupCapability, PermissionKey } from '@/features/team/permissions';
import type { WeddingMemberRole } from '@/features/weddings/types';

export type CoordinatedGroup = {
  group_id: string;
  can_delete: boolean;
  can_send_invitations: boolean;
};

export type WeddingAccess = {
  wedding_id: string;
  role: WeddingMemberRole;
  is_owner: boolean;
  permissions: PermissionKey[];
  coordinated_groups: CoordinatedGroup[];
};

export type TeamMember = {
  user_id: string;
  role: WeddingMemberRole;
  joined_at: string;
  invited_by: string | null;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  is_owner: boolean;
  is_self: boolean;
};

export type TeamInviteKind = 'collaborator' | 'co_owner';

export type TeamInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type TeamInvitePreview = {
  invite_id: string;
  wedding_id: string;
  wedding_title: string;
  inviter_name: string;
  role: WeddingMemberRole;
  invite_kind: TeamInviteKind;
  expires_at: string;
  invited_email_masked: string | null;
  status: TeamInviteStatus;
};

export type TeamInviteListItem = {
  id: string;
  invited_email: string;
  invited_email_masked: string | null;
  role: WeddingMemberRole;
  invite_kind: TeamInviteKind;
  status: TeamInviteStatus;
  expires_at: string;
  created_at: string;
  last_sent_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string;
};

export type CreateTeamInviteInput = {
  weddingId: string;
  email: string;
  inviteKind?: TeamInviteKind;
  roleTemplate?: string;
  permissions?: PermissionKey[] | null;
  groupAssignments?: {
    groupId: string;
    canDelete?: boolean;
    canSendInvitations?: boolean;
  }[];
  /** ISO-8601 duration string accepted by Postgres intervals, e.g. '7 days'. */
  expiresIn?: string;
};

export type CreatedTeamInvite = {
  inviteId: string;
  rawToken: string;
  expiresAt: string;
};

export type { GuestGroupCapability, PermissionKey, WeddingMemberRole };
