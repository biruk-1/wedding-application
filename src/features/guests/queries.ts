import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  createGuest,
  createGuestGroup,
  deleteGuest,
  deleteGuestGroup,
  ensureFamilyGuestGroups,
  getGuest,
  getGuestStats,
  listGuestGroups,
  listGuestSummaries,
  listGuests,
  updateGuest,
  updateGuestGroup,
} from '@/features/guests/services/guestService';
import {
  cancelInvitation,
  createInvitation,
  createInvitationDesign,
  createWeddingEvent,
  getInvitationPreviewByToken,
  listInvitationDesigns,
  listInvitations,
  listRsvpsForWedding,
  listWeddingEvents,
  markInvitationSent,
  setGuestRsvp,
  submitRsvpByToken,
  updateInvitationDesign,
} from '@/features/guests/services/invitationService';
import {
  assignGuest,
  createTable,
  deleteTable,
  listAssignments,
  listTables,
  unassignGuest,
  updateTable,
} from '@/features/guests/services/seatingService';
import type {
  CreateInvitationInput,
  GuestGroupInput,
  GuestInput,
  GuestListItem,
  GuestRsvp,
  GuestServerFilters,
  InvitationDesignInput,
  PublicInvitePreview,
  RsvpResponse,
  SeatingTableInput,
  WeddingEventInput,
} from '@/features/guests/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

const SEARCH_DEBOUNCE_MS = 250;
const EMPTY_GUESTS: GuestListItem[] = [];

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

// --- Groups ----------------------------------------------------------------------------------

export function useGuestGroups(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.guestGroups(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listGuestGroups(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useSaveGuestGroup(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: GuestGroupInput }
        | { mode: 'edit'; groupId: string; values: Partial<GuestGroupInput> },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createGuestGroup(weddingId, input.values)
          : await updateGuestGroup(weddingId, input.groupId, input.values),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.guestGroups(requireUser(userId), weddingId) }),
  });
}

export function useDeleteGuestGroup(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      requireUser(userId);
      return unwrap(await deleteGuestGroup(weddingId, groupId));
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      // Members lose their group and group-only invitations are removed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestGroups(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestsRoot(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(uid, weddingId) });
    },
  });
}

// --- Guests ----------------------------------------------------------------------------------

export function useGuestSummaries(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.guestSummaries(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listGuestSummaries(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

/** Server-scoped totals so coordinators never infer other groups' counts. */
export function useGuestStats(weddingId: string | undefined, eventId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.guestStats(userId ?? '', weddingId ?? '', eventId),
    queryFn: async () => unwrap(await getGuestStats(weddingId!, eventId)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useEnsureFamilyGuestGroups(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      requireUser(userId);
      return unwrap(await ensureFamilyGuestGroups(weddingId));
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestGroups(uid, weddingId) });
    },
  });
}

/** Paged guest list. Search is debounced so each keystroke does not start a request. */
export function useGuestList(
  weddingId: string | undefined,
  filters: { query: string; groupId: string | null },
) {
  const userId = useUserId();
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const serverFilters = useMemo<GuestServerFilters>(
    () => ({ query: debouncedQuery, groupId: filters.groupId }),
    [debouncedQuery, filters.groupId],
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.guests(userId ?? '', weddingId ?? '', serverFilters),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await listGuests(weddingId!, serverFilters, pageParam, signal)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.length : undefined),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
    // While a new search loads, keep the previous rows on screen.
    placeholderData: keepPreviousData,
  });

  const guests = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? EMPTY_GUESTS,
    [query.data],
  );

  return {
    guests,
    isLoading: query.isPending,
    isUpdating: query.isPlaceholderData || filters.query.trim() !== debouncedQuery,
    error: query.data ? null : query.error,
    refreshError: query.data && query.isRefetchError ? query.error : null,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refresh: () => void query.refetch(),
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    nextPageError: query.isFetchNextPageError ? query.error : null,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetching) void query.fetchNextPage();
    },
  };
}

export function useGuest(weddingId: string | undefined, guestId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.guest(userId ?? '', weddingId ?? '', guestId ?? ''),
    queryFn: async ({ signal }) => unwrap(await getGuest(weddingId!, guestId!, signal)),
    enabled: Boolean(userId && weddingId && guestId),
    staleTime: staleTimes.collaborative,
  });
}

export function useSaveGuest(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: GuestInput }
        | { mode: 'edit'; guestId: string; values: Partial<GuestInput> },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createGuest(weddingId, input.values)
          : await updateGuest(weddingId, input.guestId, input.values),
      );
    },
    onSuccess: (guest) => {
      const uid = requireUser(userId);
      queryClient.setQueryData(queryKeys.guest(uid, weddingId, guest.id), guest);
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestsRoot(uid, weddingId) });
      void queryClient.invalidateQueries({
        queryKey: ['u', uid, 'wedding', weddingId, 'guests', 'stats'],
      });
    },
  });
}

export function useDeleteGuest(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (guestId: string) => {
      requireUser(userId);
      return unwrap(await deleteGuest(weddingId, guestId));
    },
    onSuccess: (_result, guestId) => {
      const uid = requireUser(userId);
      queryClient.removeQueries({ queryKey: queryKeys.guest(uid, weddingId, guestId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestsRoot(uid, weddingId) });
      void queryClient.invalidateQueries({
        queryKey: ['u', uid, 'wedding', weddingId, 'guests', 'stats'],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.guestRsvps(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.seatingRoot(uid, weddingId) });
    },
  });
}

// --- Events and RSVPs ------------------------------------------------------------------------

export function useWeddingEvents(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingEvents(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingEvents(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useCreateWeddingEvent(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WeddingEventInput) => {
      requireUser(userId);
      return unwrap(await createWeddingEvent(weddingId, input));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.weddingEvents(requireUser(userId), weddingId) }),
  });
}

export function useGuestRsvps(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.guestRsvps(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listRsvpsForWedding(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

/** Planner RSVP upsert; merges the saved row into the cache immediately. */
export function useSetGuestRsvp(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { guestId: string; eventId: string; response: RsvpResponse }) => {
      requireUser(userId);
      return unwrap(await setGuestRsvp(input.guestId, input.eventId, input.response));
    },
    onSuccess: (saved) => {
      const key = queryKeys.guestRsvps(requireUser(userId), weddingId);
      queryClient.setQueryData<GuestRsvp[]>(key, (current) => {
        if (!current) return current;
        const without = current.filter(
          (row) => !(row.guest_id === saved.guest_id && row.event_id === saved.event_id),
        );
        return [...without, saved];
      });
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// --- Designs and invitations -----------------------------------------------------------------

export function useInvitationDesigns(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.invitationDesigns(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listInvitationDesigns(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useSaveInvitationDesign(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: InvitationDesignInput }
        | { mode: 'edit'; designId: string; values: InvitationDesignInput },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createInvitationDesign(weddingId, input.values)
          : await updateInvitationDesign(weddingId, input.designId, input.values),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitationDesigns(requireUser(userId), weddingId),
      }),
  });
}

export function useInvitations(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.invitations(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listInvitations(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

/**
 * Creates an invitation. The resolved value contains the raw token: read it in `onSuccess`, keep
 * it in component state only, and call `reset()` so the mutation cache does not retain it.
 */
export function useCreateInvitation(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CreateInvitationInput, 'weddingId'>) => {
      requireUser(userId);
      return unwrap(await createInvitation({ weddingId, ...input }));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations(requireUser(userId), weddingId) }),
  });
}

export function useMarkInvitationSent(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      requireUser(userId);
      return unwrap(await markInvitationSent(invitationId));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations(requireUser(userId), weddingId) }),
  });
}

export function useCancelInvitation(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      requireUser(userId);
      return unwrap(await cancelInvitation(weddingId, invitationId));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.invitations(requireUser(userId), weddingId) }),
  });
}

// --- Seating ---------------------------------------------------------------------------------

export function useSeatingTables(weddingId: string | undefined, eventId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.seatingTables(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listTables(eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
  });
}

export function useSeatingAssignments(weddingId: string | undefined, eventId: string | null) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.seatingAssignments(userId ?? '', weddingId ?? '', eventId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listAssignments(eventId!, signal)),
    enabled: Boolean(userId && weddingId && eventId),
    staleTime: staleTimes.collaborative,
  });
}

function useSeatingInvalidation(weddingId: string, eventId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return () => {
    const uid = requireUser(userId);
    void queryClient.invalidateQueries({ queryKey: queryKeys.seatingTables(uid, weddingId, eventId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.seatingAssignments(uid, weddingId, eventId) });
  };
}

export function useSaveSeatingTable(weddingId: string, eventId: string) {
  const userId = useUserId();
  const invalidate = useSeatingInvalidation(weddingId, eventId);
  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: SeatingTableInput }
        | { mode: 'edit'; tableId: string; values: Partial<SeatingTableInput> },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createTable(eventId, input.values)
          : await updateTable(eventId, input.tableId, input.values),
      );
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSeatingTable(weddingId: string, eventId: string) {
  const userId = useUserId();
  const invalidate = useSeatingInvalidation(weddingId, eventId);
  return useMutation({
    mutationFn: async (tableId: string) => {
      requireUser(userId);
      return unwrap(await deleteTable(eventId, tableId));
    },
    onSuccess: invalidate,
  });
}

export function useAssignGuest(weddingId: string, eventId: string) {
  const userId = useUserId();
  const invalidate = useSeatingInvalidation(weddingId, eventId);
  return useMutation({
    mutationFn: async (input: { tableId: string; guestId: string }) => {
      requireUser(userId);
      return unwrap(await assignGuest({ eventId, ...input }));
    },
    onSuccess: invalidate,
  });
}

export function useUnassignGuest(weddingId: string, eventId: string) {
  const userId = useUserId();
  const invalidate = useSeatingInvalidation(weddingId, eventId);
  return useMutation({
    mutationFn: async (guestId: string) => {
      requireUser(userId);
      return unwrap(await unassignGuest(eventId, guestId));
    },
    onSuccess: invalidate,
  });
}

// --- Public invitation (token) ---------------------------------------------------------------

/** No user id is required: this screen works signed out. The token is only a cache key. */
export function usePublicInvite(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicInvite(token ?? ''),
    queryFn: async ({ signal }) => unwrap(await getInvitationPreviewByToken(token!, signal)),
    enabled: Boolean(token),
    staleTime: staleTimes.collaborative,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitPublicRsvp(token: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { guestId: string; eventId: string; response: RsvpResponse }) =>
      unwrap(await submitRsvpByToken({ rawToken: token ?? '', ...input })),
    onSuccess: (saved) => {
      queryClient.setQueryData<PublicInvitePreview>(queryKeys.publicInvite(token ?? ''), (current) => {
        if (!current) return current;
        return {
          ...current,
          guests: current.guests.map((guest) => {
            if (guest.id !== saved.guest_id) return guest;
            const rsvps = guest.rsvps.filter((rsvp) => rsvp.event_id !== saved.event_id);
            rsvps.push({
              event_id: saved.event_id,
              response: saved.response as RsvpResponse,
              responded_at: saved.responded_at,
            });
            return { ...guest, rsvps };
          }),
        };
      });
    },
  });
}
