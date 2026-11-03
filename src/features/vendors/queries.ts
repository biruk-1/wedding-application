/**
 * React Query hooks for vendors.
 * Marketplace UI currently uses `hooks/useVendorMarketplace` (client filters).
 * These hooks exist for profile/shortlist/inquiry and future server-paged lists.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createVendorInquiry,
  getVendorProfile,
  getWeddingVendorLink,
  listPublishedVendors,
  listVendorCategories,
  removeVendorFromWedding,
  saveVendorToWedding,
} from '@/features/vendors/services/vendorService';
import type { CreateInquiryInput } from '@/features/vendors/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
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
