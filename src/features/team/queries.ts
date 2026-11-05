import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import type { GuestGroupCapability, PermissionKey } from '@/features/team/permissions';
import { clearPendingTeamInvite } from '@/features/team/services/pendingTeamInvite';
import {
  acceptTeamInvite,
  createTeamInvite,
  getMyWeddingAccess,
  getTeamInvitePreview,
  leaveWedding,
  listTeamInvites,
  listTeamMembers,
  removeMember,
  resendTeamInvite,
  revokeTeamInvite,
} from '@/features/team/services/teamService';
import type { CreateTeamInviteInput, WeddingAccess } from '@/features/team/types';
import {
  accessCan,
  accessCanInGroup,
  legacyCanWrite,
} from '@/features/team/utils/teamAccess';
import { unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

function useTeamUserId(): string | null {
  return useAuth().user?.id ?? null;
}

/**
 * Caller's Planning Team access for one wedding.
 * Use `can` / `canInGroup` for feature UI; `canWrite` is a blunt write hint from effective permissions.
 * Enforcement is always RLS / RPC — this hook is display only.
 */
export function useWeddingAccess(weddingId: string | undefined) {
  const userId = useTeamUserId();
  const query = useQuery({
    queryKey: queryKeys.myAccess(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await getMyWeddingAccess(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.wedding,
  });

  const access: WeddingAccess | null = query.data ?? null;

  return {
    access,
    role: access?.role ?? null,
    isOwner: Boolean(access?.is_owner),
    canWrite: legacyCanWrite(access),
    can: (permission: PermissionKey) => accessCan(access, permission),
    canInGroup: (groupId: string | null | undefined, capability: GuestGroupCapability) =>
      accessCanInGroup(access, groupId, capability),
    isLoading: query.isPending,
    error: query.error,
    refresh: () => void query.refetch(),
  };
}

export function useTeamMembers(weddingId: string | undefined) {
  const userId = useTeamUserId();
  return useQuery({
    queryKey: queryKeys.teamMembers(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await listTeamMembers(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useRemoveMember(weddingId: string | undefined) {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberUserId: string) => {
      if (!weddingId) throw new Error('Wedding is required.');
      return unwrap(await removeMember(weddingId, memberUserId));
    },
    onSuccess: () => {
      if (!userId || !weddingId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamMembers(userId, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingMembers(userId, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myAccess(userId, weddingId) });
    },
  });
}

export function useLeaveWedding() {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weddingId: string) => unwrap(await leaveWedding(weddingId)),
    onSuccess: (_data, weddingId) => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.memberships(userId) });
      void queryClient.removeQueries({ queryKey: queryKeys.wedding(userId, weddingId) });
      void queryClient.removeQueries({ queryKey: queryKeys.myAccess(userId, weddingId) });
      void queryClient.removeQueries({ queryKey: queryKeys.teamMembers(userId, weddingId) });
    },
  });
}

/** Token-authorised preview; works signed out. */
export function useTeamInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicTeamInvite(token ?? ''),
    queryFn: async () => unwrap(await getTeamInvitePreview(token!)),
    enabled: Boolean(token),
    staleTime: staleTimes.collaborative,
  });
}

export function useTeamInvites(weddingId: string | undefined) {
  const userId = useTeamUserId();
  return useQuery({
    queryKey: queryKeys.teamInvites(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await listTeamInvites(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useCreateTeamInvite(weddingId: string | undefined) {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateTeamInviteInput, 'weddingId'>) => {
      if (!weddingId) throw new Error('Wedding is required.');
      return unwrap(await createTeamInvite({ ...input, weddingId }));
    },
    onSuccess: () => {
      if (!userId || !weddingId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvites(userId, weddingId) });
    },
  });
}

export function useResendTeamInvite(weddingId: string | undefined) {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => unwrap(await resendTeamInvite(inviteId)),
    onSuccess: () => {
      if (!userId || !weddingId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvites(userId, weddingId) });
    },
  });
}

export function useRevokeTeamInvite(weddingId: string | undefined) {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => unwrap(await revokeTeamInvite(inviteId)),
    onSuccess: () => {
      if (!userId || !weddingId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamInvites(userId, weddingId) });
    },
  });
}

export function useAcceptTeamInvite() {
  const userId = useTeamUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rawToken: string) => unwrap(await acceptTeamInvite(rawToken)),
    onSuccess: async (membership) => {
      await clearPendingTeamInvite();
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.memberships(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teamMembers(userId, membership.weddingId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.myAccess(userId, membership.weddingId),
      });
    },
  });
}
