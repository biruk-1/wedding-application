import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useWeddingAccess } from '@/features/team/queries';
import { membershipsQuery } from '@/features/weddings/membershipsQuery';
import {
  getWeddingById,
  updateWedding,
  uploadWeddingCover,
} from '@/features/weddings/services/weddingService';
import type { WeddingMembership } from '@/features/weddings/types';
import { unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

/** Signed-in user id from the auth context (no network call). */
export function useUserId(): string | null {
  return useAuth().user?.id ?? null;
}

export function useMyWeddings() {
  const { user, isLoading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({ ...membershipsQuery(userId ?? ''), enabled: Boolean(userId) });

  return {
    memberships: query.data ?? ([] as WeddingMembership[]),
    /** True only when nothing is cached yet — cached data renders while refreshing. */
    isLoading: authLoading || (Boolean(userId) && query.isPending),
    isRefreshing: query.isFetching && !query.isPending,
    error: query.data ? null : query.error,
    refreshError: query.data ? query.error : null,
    refresh: () => void query.refetch(),
  };
}

/**
 * Wedding detail, seeded from the memberships list so the dashboard renders without waiting
 * for a second request; it still revalidates in the background when stale.
 */
export function useWedding(weddingId: string | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const membershipsKey = queryKeys.memberships(userId ?? '');

  return useQuery({
    queryKey: queryKeys.wedding(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await getWeddingById(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.wedding,
    initialData: () =>
      queryClient
        .getQueryData<WeddingMembership[]>(membershipsKey)
        ?.find((membership) => membership.wedding_id === weddingId)?.wedding,
    initialDataUpdatedAt: () => queryClient.getQueryState(membershipsKey)?.dataUpdatedAt,
  });
}

/**
 * Caller's role / write flag for a wedding.
 * Shim over `useWeddingAccess` so screens can migrate gradually. `canWrite` still follows the
 * legacy role rule (not viewer) until Milestone 5 backfills permissions and switches RLS.
 * UI hides controls only; RLS / RPCs enforce access.
 */
export function useWeddingRole(weddingId: string | undefined) {
  const access = useWeddingAccess(weddingId);
  return {
    role: access.role,
    canWrite: access.canWrite,
    isLoading: access.isLoading,
  };
}

/** Pick → upload → save `weddings.cover_image_url` for the dashboard hero. */
export function useUploadWeddingCover(weddingId: string | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { uri: string; mimeType?: string | null }) => {
      if (!userId || !weddingId) throw new Error('Sign in to update the cover photo.');
      const uploaded = unwrap(await uploadWeddingCover({ weddingId, ...input }));
      return unwrap(
        await updateWedding(weddingId, { coverImageUrl: uploaded.publicUrl }),
      );
    },
    onSuccess: (wedding) => {
      if (!userId || !weddingId) return;
      queryClient.setQueryData(queryKeys.wedding(userId, weddingId), wedding);
      queryClient.setQueryData<WeddingMembership[]>(
        queryKeys.memberships(userId),
        (prev) =>
          prev?.map((membership) =>
            membership.wedding_id === weddingId
              ? { ...membership, wedding }
              : membership,
          ) ?? prev,
      );
    },
  });
}
