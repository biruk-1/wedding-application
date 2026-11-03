import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { membershipsQuery } from '@/features/weddings/membershipsQuery';
import { getWeddingById } from '@/features/weddings/services/weddingService';
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
 * The caller's role in a wedding, derived from the shared memberships query (no extra request).
 * UI uses `canWrite` only to hide controls; RLS (`can_write_wedding`) enforces it server-side.
 */
export function useWeddingRole(weddingId: string | undefined) {
  const userId = useUserId();
  const query = useQuery({
    ...membershipsQuery(userId ?? ''),
    enabled: Boolean(userId && weddingId),
    select: (memberships) =>
      memberships.find((membership) => membership.wedding_id === weddingId)?.role ?? null,
  });
  const role = query.data ?? null;
  return { role, canWrite: Boolean(role && role !== 'viewer'), isLoading: query.isPending };
}
