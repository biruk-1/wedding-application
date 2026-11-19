/**
 * React Query hooks for vendors.
 * The signed-in marketplace list uses `hooks/useVendorMarketplace` (client ranking). The public
 * Explore screens use the `usePublic*` hooks, which work signed out and page on the server.
 */
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDebouncedValue } from '@/features/guests/queries';
import { mapVendorError } from '@/features/vendors/services/vendorErrors';
import {
  categoryIdsMatching,
  fetchPublicServices,
  fetchVendorCategories,
  fetchVendorCities,
  fetchVendorPage,
  fetchVendorProfile,
  type QueryResult,
} from '@/features/vendors/services/vendorQueries';
import {
  createVendorInquiry,
  getVendorProfile,
  getWeddingVendorLink,
  listPublishedVendors,
  listVendorCategories,
  removeVendorFromWedding,
  saveVendorToWedding,
} from '@/features/vendors/services/vendorService';
import type {
  CreateInquiryInput,
  VendorFilters,
  VendorListItem,
  VendorServerFilters,
  VendorSort,
} from '@/features/vendors/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase';

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

async function settle<T>(request: Promise<QueryResult<T>>): Promise<T> {
  const result = await request;
  if (result.error) throw new QueryError(mapVendorError(result.error));
  return result.data;
}

export function useVendorCategories() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.vendorCategories(userId ?? ''),
    queryFn: async () => unwrap(await listVendorCategories()),
    enabled: Boolean(userId),
    staleTime: staleTimes.reference,
  });
}

export function usePublishedVendors() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.vendorList(userId ?? '', {
      query: '',
      categoryId: null,
      city: null,
      minPrice: null,
      maxPrice: null,
      queryCategoryIds: [],
    }),
    queryFn: async () => unwrap(await listPublishedVendors()),
    enabled: Boolean(userId),
    staleTime: staleTimes.vendors,
  });
}

export function useVendorProfile(vendorId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.vendorProfile(userId ?? '', vendorId ?? ''),
    queryFn: async () => unwrap(await getVendorProfile(vendorId!)),
    enabled: Boolean(userId && vendorId),
    staleTime: staleTimes.vendors,
  });
}

export function useWeddingVendorLink(weddingId: string | undefined, vendorId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingVendor(userId ?? '', weddingId ?? '', vendorId ?? ''),
    queryFn: async () => unwrap(await getWeddingVendorLink(weddingId!, vendorId!)),
    enabled: Boolean(userId && weddingId && vendorId),
    staleTime: staleTimes.collaborative,
  });
}

export function useToggleSavedVendor(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { vendorId: string; linkId?: string | null; save: boolean }) => {
      requireUser(userId);
      if (input.save) {
        return unwrap(await saveVendorToWedding({ weddingId, vendorId: input.vendorId }));
      }
      if (!input.linkId) {
        throw new QueryError({ code: 'not_found', message: 'Vendor is not saved on this wedding.' });
      }
      return unwrap(await removeVendorFromWedding(input.linkId));
    },
    onSuccess: (_data, variables) => {
      const uid = requireUser(userId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.weddingVendor(uid, weddingId, variables.vendorId),
      });
    },
  });
}

export function useCreateInquiry(weddingId: string) {
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: Omit<CreateInquiryInput, 'weddingId'>) => {
      requireUser(userId);
      return unwrap(await createVendorInquiry({ ...input, weddingId }));
    },
  });
}

// --- Public Explore (works signed out) -------------------------------------------------------

const EMPTY_VENDORS: VendorListItem[] = [];

export function usePublicVendorCategories() {
  return useQuery({
    queryKey: queryKeys.publicVendorCategories(),
    queryFn: ({ signal }) => settle(fetchVendorCategories(supabase, signal)),
    staleTime: staleTimes.reference,
  });
}

export function usePublicVendorCities() {
  return useQuery({
    queryKey: queryKeys.publicVendorCities(),
    queryFn: ({ signal }) => settle(fetchVendorCities(supabase, signal)),
    staleTime: staleTimes.vendors,
  });
}

export function usePublicServices(categoryId: string | null) {
  return useQuery({
    queryKey: queryKeys.publicVendorServices(categoryId),
    queryFn: ({ signal }) => settle(fetchPublicServices(supabase, { categoryId }, signal)),
    staleTime: staleTimes.vendors,
    placeholderData: keepPreviousData,
  });
}

export function usePublicVendorProfile(vendorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicVendorProfile(vendorId ?? ''),
    queryFn: async ({ signal }) => {
      const profile = await settle(fetchVendorProfile(supabase, vendorId!, signal));
      if (!profile) {
        throw new QueryError({
          code: 'not_found',
          message: 'This vendor is not available right now.',
        });
      }
      return profile;
    },
    enabled: Boolean(vendorId),
    staleTime: staleTimes.vendors,
  });
}

/** Paged public vendor search. Free text is debounced; filters apply on the server. */
export function usePublicVendorSearch(filters: VendorFilters, sort: VendorSort) {
  const categories = usePublicVendorCategories();
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const serverFilters = useMemo<VendorServerFilters>(
    () => ({
      query: debouncedQuery,
      categoryId: filters.categoryId,
      city: filters.city,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      queryCategoryIds: categoryIdsMatching(debouncedQuery, categories.data ?? []),
      sort,
    }),
    [
      debouncedQuery,
      filters.categoryId,
      filters.city,
      filters.minPrice,
      filters.maxPrice,
      categories.data,
      sort,
    ],
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.publicVendorSearch(serverFilters),
    queryFn: ({ pageParam, signal }) =>
      settle(fetchVendorPage(supabase, serverFilters, pageParam, signal)),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    staleTime: staleTimes.vendors,
    placeholderData: keepPreviousData,
  });

  const vendors = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? EMPTY_VENDORS,
    [query.data],
  );

  return {
    vendors,
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
