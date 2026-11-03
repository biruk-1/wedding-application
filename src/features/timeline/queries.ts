import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createTimelineItem,
  createWeddingEvent,
  deleteTimelineItem,
  deleteWeddingEvent,
  getWeddingEvent,
  listRelatedBookings,
  listRelatedTasks,
  listTimelineItems,
  listWeddingEvents,
  reorderTimelineItems,
  updateTimelineItem,
  updateWeddingEvent,
} from '@/features/timeline/services/timelineService';
import type { EventInput, TimelineItemInput } from '@/features/timeline/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

function invalidateEvents(queryClient: ReturnType<typeof useQueryClient>, userId: string, weddingId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.weddingEvents(userId, weddingId) });
}

export function useWeddingEvents(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingEvents(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingEvents(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useWeddingEvent(weddingId: string | undefined, eventId: string | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const listKey = queryKeys.weddingEvents(userId ?? '', weddingId ?? '');
  return useQuery({
    queryKey: queryKeys.weddingEvent(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await getWeddingEvent(weddingId!, eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
    initialData: () => {
      const list = queryClient.getQueryData<import('@/features/timeline/types').WeddingEvent[]>(listKey);
      return list?.find((event) => event.id === eventId);
    },
    initialDataUpdatedAt: () => queryClient.getQueryState(listKey)?.dataUpdatedAt,
  });
}

export function useTimelineItems(weddingId: string | undefined, eventId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.timelineItems(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listTimelineItems(eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
  });
}

export function useEventRelatedTasks(weddingId: string | undefined, eventId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.eventRelatedTasks(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listRelatedTasks(weddingId!, eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
  });
}

export function useEventRelatedBookings(weddingId: string | undefined, eventId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.eventRelatedBookings(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listRelatedBookings(weddingId!, eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
  });
}

export function useSaveWeddingEvent(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { mode: 'create'; values: EventInput } | { mode: 'edit'; eventId: string; values: EventInput },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createWeddingEvent(weddingId, input.values)
          : await updateWeddingEvent(weddingId, input.eventId, input.values),
      );
    },
    onSuccess: (event) => {
      const uid = requireUser(userId);
      invalidateEvents(queryClient, uid, weddingId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.weddingEvent(uid, weddingId, event.id),
      });
    },
  });
}

export function useDeleteWeddingEvent(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      requireUser(userId);
      return unwrap(await deleteWeddingEvent(weddingId, eventId));
    },
    onSuccess: () => invalidateEvents(queryClient, requireUser(userId), weddingId),
  });
}

export function useSaveTimelineItem(weddingId: string, eventId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: TimelineItemInput }
        | { mode: 'edit'; itemId: string; values: TimelineItemInput },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createTimelineItem(eventId, input.values)
          : await updateTimelineItem(eventId, input.itemId, input.values),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.timelineItems(requireUser(userId), weddingId, eventId),
      });
    },
  });
}

export function useDeleteTimelineItem(weddingId: string, eventId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      requireUser(userId);
      return unwrap(await deleteTimelineItem(eventId, itemId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.timelineItems(requireUser(userId), weddingId, eventId),
      });
    },
  });
}

export function useReorderTimelineItems(weddingId: string, eventId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      requireUser(userId);
      return unwrap(await reorderTimelineItems(eventId, orderedIds));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.timelineItems(requireUser(userId), weddingId, eventId),
      });
    },
  });
}
