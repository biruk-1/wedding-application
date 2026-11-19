import { isPermissionKey, type PermissionKey } from '@/features/team/permissions';
import { mapTeamError, type TeamUserMessage } from '@/features/team/services/teamErrors';
import type {
  CoordinatedGroup,
  CreateTeamInviteInput,
  CreatedTeamInvite,
  GroupCoordinator,
  MyPendingTeamInvite,
  TeamActivityItem,
  TeamInviteKind,
  TeamInviteListItem,
  TeamInvitePreview,
  TeamInviteStatus,
  TeamMember,
  WeddingAccess,
} from '@/features/team/types';
import {
  accessCan,
  accessCanInGroup,
  legacyCanWrite,
} from '@/features/team/utils/teamAccess';
import { supabase } from '@/lib/supabase';
import type { WeddingMemberRole } from '@/features/weddings/types';

export { accessCan, accessCanInGroup, legacyCanWrite };

export type TeamResult<T> = { ok: true; data: T } | { ok: false; error: TeamUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): TeamResult<never> {
  return { ok: false, error: mapTeamError(error) };
}

function parseCoordinatedGroups(value: unknown): CoordinatedGroup[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.group_id !== 'string') return [];
    return [
      {
        group_id: row.group_id,
        can_delete: Boolean(row.can_delete),
        can_send_invitations: row.can_send_invitations !== false,
      },
    ];
  });
}

function parsePermissions(value: unknown): PermissionKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PermissionKey => typeof item === 'string' && isPermissionKey(item));
}

function parseAccess(raw: unknown): WeddingAccess | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.wedding_id !== 'string' || typeof row.role !== 'string') return null;
  return {
    wedding_id: row.wedding_id,
    role: row.role as WeddingMemberRole,
    is_owner: Boolean(row.is_owner),
    permissions: parsePermissions(row.permissions),
    coordinated_groups: parseCoordinatedGroups(row.coordinated_groups),
  };
}

function parseTeamMember(raw: unknown): TeamMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.user_id !== 'string' || typeof row.role !== 'string') return null;
  return {
    user_id: row.user_id,
    role: row.role as WeddingMemberRole,
    joined_at: typeof row.joined_at === 'string' ? row.joined_at : '',
    invited_by: typeof row.invited_by === 'string' ? row.invited_by : null,
    display_name: typeof row.display_name === 'string' ? row.display_name : 'Member',
    avatar_url: typeof row.avatar_url === 'string' ? row.avatar_url : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    is_owner: Boolean(row.is_owner),
    is_self: Boolean(row.is_self),
  };
}

/** Caller's role, permissions and coordinated groups for one wedding. Display only. */
export async function getMyWeddingAccess(weddingId: string): Promise<TeamResult<WeddingAccess>> {
  const { data, error } = await supabase.rpc('get_my_wedding_access', {
    p_wedding_id: weddingId,
  });
  if (error) return fail(error);
  const access = parseAccess(data);
  if (!access) return fail(new Error('No access returned'));
  return { ok: true, data: access };
}

/** Planning Team roster for a wedding the caller belongs to. */
export async function listTeamMembers(weddingId: string): Promise<TeamResult<TeamMember[]>> {
  const { data, error } = await supabase.rpc('list_team_members', {
    p_wedding_id: weddingId,
  });
  if (error) return fail(error);
  if (!Array.isArray(data)) return { ok: true, data: [] };
  return {
    ok: true,
    data: data.map(parseTeamMember).filter((member): member is TeamMember => member !== null),
  };
}

/** Owner removes a non-owner member. Cascades permissions/coordinators and clears their assignments. */
export async function removeMember(
  weddingId: string,
  userId: string,
): Promise<TeamResult<null>> {
  const { error } = await supabase.rpc('remove_member', {
    p_wedding_id: weddingId,
    p_user_id: userId,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Caller leaves the wedding. Sole owners are blocked until a co-owner exists. */
export async function leaveWedding(weddingId: string): Promise<TeamResult<null>> {
  const { error } = await supabase.rpc('leave_wedding', {
    p_wedding_id: weddingId,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Owner applies a role template (and optionally resets permissions to that template). */
export async function setMemberRoleTemplate(
  weddingId: string,
  userId: string,
  template: WeddingMemberRole,
  resetPermissions = true,
): Promise<TeamResult<{ user_id: string; role: WeddingMemberRole }>> {
  const { data, error } = await supabase.rpc('set_member_role_template', {
    p_wedding_id: weddingId,
    p_user_id: userId,
    p_template: template,
    p_reset_permissions: resetPermissions,
  });
  if (error) return fail(error);
  if (!data) return fail(new Error('No member returned'));
  return {
    ok: true,
    data: { user_id: data.user_id, role: data.role as WeddingMemberRole },
  };
}

/** Owner replaces a non-owner's grantable permissions (dependency closure applied server-side). */
export async function setMemberPermissions(
  weddingId: string,
  userId: string,
  permissions: PermissionKey[],
): Promise<TeamResult<PermissionKey[]>> {
  const { data, error } = await supabase.rpc('set_member_permissions', {
    p_wedding_id: weddingId,
    p_user_id: userId,
    p_permissions: permissions,
  });
  if (error) return fail(error);
  return { ok: true, data: parsePermissions(data) };
}

/** Owner assigns (or updates) a member as coordinator of one guest group. */
export async function assignGroupCoordinator(
  weddingId: string,
  groupId: string,
  userId: string,
  options?: { canDelete?: boolean; canSendInvitations?: boolean },
): Promise<TeamResult<null>> {
  const { error } = await supabase.rpc('assign_group_coordinator', {
    p_wedding_id: weddingId,
    p_group_id: groupId,
    p_user_id: userId,
    p_can_delete: options?.canDelete ?? false,
    p_can_send_invitations: options?.canSendInvitations ?? true,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

/** Owner removes a coordinator assignment. */
export async function unassignGroupCoordinator(
  weddingId: string,
  groupId: string,
  userId: string,
): Promise<TeamResult<null>> {
  const { error } = await supabase.rpc('unassign_group_coordinator', {
    p_wedding_id: weddingId,
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) return fail(error);
  return { ok: true, data: null };
}

function asInviteKind(value: unknown): TeamInviteKind {
  return value === 'co_owner' ? 'co_owner' : 'collaborator';
}

function asInviteStatus(value: unknown): TeamInviteStatus {
  if (value === 'accepted' || value === 'revoked' || value === 'expired') return value;
  return 'pending';
}

function parseInvitePreview(raw: unknown): TeamInvitePreview | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.invite_id !== 'string' || typeof row.wedding_id !== 'string') return null;
  return {
    invite_id: row.invite_id,
    wedding_id: row.wedding_id,
    wedding_title: typeof row.wedding_title === 'string' ? row.wedding_title : 'A celebration',
    inviter_name: typeof row.inviter_name === 'string' ? row.inviter_name : 'Someone',
    role: (typeof row.role === 'string' ? row.role : 'collaborator') as WeddingMemberRole,
    invite_kind: asInviteKind(row.invite_kind),
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : '',
    invited_email_masked:
      typeof row.invited_email_masked === 'string' ? row.invited_email_masked : null,
    status: asInviteStatus(row.status),
  };
}

function parseInviteListItem(raw: unknown): TeamInviteListItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string') return null;
  return {
    id: row.id,
    invited_email: typeof row.invited_email === 'string' ? row.invited_email : '',
    invited_email_masked:
      typeof row.invited_email_masked === 'string' ? row.invited_email_masked : null,
    role: (typeof row.role === 'string' ? row.role : 'collaborator') as WeddingMemberRole,
    invite_kind: asInviteKind(row.invite_kind),
    status: asInviteStatus(row.status),
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    last_sent_at: typeof row.last_sent_at === 'string' ? row.last_sent_at : null,
    accepted_at: typeof row.accepted_at === 'string' ? row.accepted_at : null,
    revoked_at: typeof row.revoked_at === 'string' ? row.revoked_at : null,
    invited_by: typeof row.invited_by === 'string' ? row.invited_by : '',
  };
}

/** Owner creates a Planning Team invite. Raw token is returned once for sharing. */
export async function createTeamInvite(
  input: CreateTeamInviteInput,
): Promise<TeamResult<CreatedTeamInvite>> {
  const { data, error } = await supabase.rpc('create_team_invite', {
    p_wedding_id: input.weddingId,
    p_invited_email: input.email.trim(),
    p_invite_kind: input.inviteKind ?? 'collaborator',
    p_role_template: input.roleTemplate ?? 'collaborator',
    p_permissions: input.permissions ?? undefined,
    p_group_assignments: (input.groupAssignments ?? []).map((group) => ({
      group_id: group.groupId,
      can_delete: group.canDelete ?? false,
      can_send_invitations: group.canSendInvitations ?? true,
    })),
    p_expires_in: input.expiresIn ?? '7 days',
  });
  if (error) return fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return fail(new Error('No invite returned'));
  const created = row as { invite_id?: string; raw_token?: string; expires_at?: string };
  if (!created.invite_id || !created.raw_token || !created.expires_at) {
    return fail(new Error('No invite returned'));
  }
  return {
    ok: true,
    data: {
      inviteId: created.invite_id,
      rawToken: created.raw_token,
      expiresAt: created.expires_at,
    },
  };
}

export async function resendTeamInvite(
  inviteId: string,
  expiresIn = '7 days',
): Promise<TeamResult<CreatedTeamInvite>> {
  const { data, error } = await supabase.rpc('resend_team_invite', {
    p_invite_id: inviteId,
    p_expires_in: expiresIn,
  });
  if (error) return fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return fail(new Error('No invite returned'));
  const created = row as { invite_id?: string; raw_token?: string; expires_at?: string };
  if (!created.invite_id || !created.raw_token || !created.expires_at) {
    return fail(new Error('No invite returned'));
  }
  return {
    ok: true,
    data: {
      inviteId: created.invite_id,
      rawToken: created.raw_token,
      expiresAt: created.expires_at,
    },
  };
}

export async function revokeTeamInvite(inviteId: string): Promise<TeamResult<null>> {
  const { error } = await supabase.rpc('revoke_team_invite', { p_invite_id: inviteId });
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function listTeamInvites(
  weddingId: string,
): Promise<TeamResult<TeamInviteListItem[]>> {
  const { data, error } = await supabase.rpc('list_team_invites', {
    p_wedding_id: weddingId,
  });
  if (error) return fail(error);
  if (!Array.isArray(data)) return { ok: true, data: [] };
  return {
    ok: true,
    data: data
      .map(parseInviteListItem)
      .filter((item): item is TeamInviteListItem => item !== null),
  };
}

/** Public preview for a join link (works signed out). */
export async function getTeamInvitePreview(
  rawToken: string,
): Promise<TeamResult<TeamInvitePreview>> {
  const { data, error } = await supabase.rpc('get_team_invite_preview', {
    p_raw_token: rawToken,
  });
  if (error) return fail(error);
  const preview = parseInvitePreview(data);
  if (!preview) return fail(new Error('invalid invite token'));
  return { ok: true, data: preview };
}

/**
 * Confirms the typed email matches a pending invite token before sending Auth OTP.
 * Does not accept the invite and does not reveal whether the email already has an account.
 */
export async function validateTeamInviteEmail(
  rawToken: string,
  email: string,
): Promise<TeamResult<{ weddingTitle: string; inviterName: string }>> {
  const { data, error } = await supabase.rpc('validate_team_invite_email', {
    p_raw_token: rawToken,
    p_email: email.trim(),
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') return fail(new Error('invalid invite token'));
  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      weddingTitle: typeof row.wedding_title === 'string' ? row.wedding_title : 'A celebration',
      inviterName: typeof row.inviter_name === 'string' ? row.inviter_name : 'Someone',
    },
  };
}

export async function acceptTeamInvite(
  rawToken: string,
): Promise<TeamResult<{ weddingId: string; role: WeddingMemberRole; userId: string }>> {
  const { data, error } = await supabase.rpc('accept_team_invite', {
    p_raw_token: rawToken,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') return fail(new Error('No membership returned'));
  const row = data as { wedding_id?: string; role?: string; user_id?: string };
  if (!row.wedding_id || !row.role || !row.user_id) {
    return fail(new Error('No membership returned'));
  }
  return {
    ok: true,
    data: {
      weddingId: row.wedding_id,
      role: row.role as WeddingMemberRole,
      userId: row.user_id,
    },
  };
}

function parseMyPendingInvite(raw: unknown): MyPendingTeamInvite | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.wedding_id !== 'string') return null;
  return {
    id: row.id,
    wedding_id: row.wedding_id,
    wedding_title: typeof row.wedding_title === 'string' ? row.wedding_title : 'A celebration',
    role: (typeof row.role === 'string' ? row.role : 'collaborator') as WeddingMemberRole,
    invite_kind: asInviteKind(row.invite_kind),
    status: asInviteStatus(row.status),
    expires_at: typeof row.expires_at === 'string' ? row.expires_at : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    inviter_name: typeof row.inviter_name === 'string' ? row.inviter_name : 'Someone',
  };
}

/** Pending invites addressed to the signed-in user's email (any wedding). */
export async function listMyPendingTeamInvites(): Promise<TeamResult<MyPendingTeamInvite[]>> {
  const { data, error } = await supabase.rpc('list_my_pending_team_invites');
  if (error) return fail(error);
  if (!Array.isArray(data)) return { ok: true, data: [] };
  return {
    ok: true,
    data: data
      .map(parseMyPendingInvite)
      .filter((item): item is MyPendingTeamInvite => item !== null),
  };
}

/** Accept from the inbox (email must match; no deep-link token needed). */
export async function acceptMyTeamInvite(
  inviteId: string,
): Promise<TeamResult<{ weddingId: string; role: WeddingMemberRole; userId: string }>> {
  const { data, error } = await supabase.rpc('accept_my_team_invite', {
    p_invite_id: inviteId,
  });
  if (error) return fail(error);
  if (!data || typeof data !== 'object') return fail(new Error('No membership returned'));
  const row = data as { wedding_id?: string; role?: string; user_id?: string };
  if (!row.wedding_id || !row.role || !row.user_id) {
    return fail(new Error('No membership returned'));
  }
  return {
    ok: true,
    data: {
      weddingId: row.wedding_id,
      role: row.role as WeddingMemberRole,
      userId: row.user_id,
    },
  };
}

/** Grantable permissions currently held by a non-owner (owners hold everything implicitly). */
export async function listMemberPermissions(
  weddingId: string,
  userId: string,
): Promise<TeamResult<PermissionKey[]>> {
  const { data, error } = await supabase
    .from('wedding_member_permissions')
    .select('permission')
    .eq('wedding_id', weddingId)
    .eq('user_id', userId);
  if (error) return fail(error);
  return {
    ok: true,
    data: (data ?? [])
      .map((row) => row.permission)
      .filter((key): key is PermissionKey => isPermissionKey(key)),
  };
}

/** Default permissions for a role template (for invite preview / editor reset). */
export async function listRoleTemplatePermissions(
  template: string,
): Promise<TeamResult<PermissionKey[]>> {
  const { data, error } = await supabase
    .from('wedding_role_templates')
    .select('permission')
    .eq('template', template);
  if (error) return fail(error);
  return {
    ok: true,
    data: (data ?? [])
      .map((row) => row.permission)
      .filter((key): key is PermissionKey => isPermissionKey(key)),
  };
}

/** Coordinators for one group, or all groups in a wedding when groupId is omitted.
 * Display names are filled by the caller from `list_team_members` (no profile FK on this table).
 */
export async function listGroupCoordinators(
  weddingId: string,
  groupId?: string,
): Promise<TeamResult<GroupCoordinator[]>> {
  let query = supabase
    .from('guest_group_coordinators')
    .select('group_id, user_id, can_delete, can_send_invitations, assigned_at')
    .eq('wedding_id', weddingId)
    .order('assigned_at', { ascending: true });
  if (groupId) query = query.eq('group_id', groupId);

  const { data, error } = await query;
  if (error) return fail(error);

  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      group_id: row.group_id,
      user_id: row.user_id,
      can_delete: row.can_delete,
      can_send_invitations: row.can_send_invitations,
      assigned_at: row.assigned_at,
      display_name: 'Member',
    })),
  };
}

/** Groups a specific member coordinates. */
export async function listMemberCoordinations(
  weddingId: string,
  userId: string,
): Promise<TeamResult<GroupCoordinator[]>> {
  const { data, error } = await supabase
    .from('guest_group_coordinators')
    .select('group_id, user_id, can_delete, can_send_invitations, assigned_at')
    .eq('wedding_id', weddingId)
    .eq('user_id', userId)
    .order('assigned_at', { ascending: true });
  if (error) return fail(error);
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      group_id: row.group_id,
      user_id: row.user_id,
      can_delete: row.can_delete,
      can_send_invitations: row.can_send_invitations,
      assigned_at: row.assigned_at,
      display_name: 'Member',
    })),
  };
}

/** Wedding-wide activity feed (RLS filters by permission). */
export async function listTeamActivity(
  weddingId: string,
  limit = 80,
): Promise<TeamResult<TeamActivityItem[]>> {
  const { data, error } = await supabase
    .from('wedding_activity_log')
    .select(
      'id, action, actor_id, created_at, entity_type, entity_id, summary, required_permission, actor:profiles!wedding_activity_log_actor_id_fkey ( display_name )',
    )
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return fail(error);

  return {
    ok: true,
    data: (data ?? []).map((row) => {
      const actor = row.actor as { display_name: string } | { display_name: string }[] | null;
      const resolved = Array.isArray(actor) ? actor[0] : actor;
      return {
        id: row.id,
        action: row.action,
        actor_id: row.actor_id,
        actor_name: resolved?.display_name?.trim() || null,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        created_at: row.created_at,
        summary: (row.summary ?? {}) as Record<string, unknown>,
        required_permission: row.required_permission,
      };
    }),
  };
}
