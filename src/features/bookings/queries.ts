import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';

import {
  acceptVendorQuote,
  getWeddingBooking,
  getWeddingQuote,
  listWeddingBookings,
  listWeddingQuotes,
} from '@/features/bookings/services/bookingService';
import {
  initializeBookingCheckout,
  verifyBookingCheckout,
} from '@/features/bookings/services/chapaService';
import type { PaymentPurpose } from '@/features/bookings/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

export function useWeddingQuotes(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingQuotes(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingQuotes(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useWeddingQuote(weddingId: string | undefined, quoteId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingQuote(userId ?? '', weddingId ?? '', quoteId ?? ''),
    queryFn: async ({ signal }) => {
      const quote = unwrap(await getWeddingQuote(weddingId!, quoteId!, signal));
      if (!quote) {
        throw new QueryError({ code: 'not_found', message: 'Quote not found.' });
      }
      return quote;
    },
    enabled: Boolean(userId && weddingId && quoteId),
    staleTime: staleTimes.collaborative,
  });
}

export function useAcceptQuote(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      requireUser(userId);
      return unwrap(await acceptVendorQuote(quoteId));
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingQuotes(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingBookings(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgetItemsRoot(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingBudget(uid, weddingId) });
    },
  });
}

export function useWeddingBookings(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingBookings(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingBookings(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useWeddingBooking(weddingId: string | undefined, bookingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingBooking(userId ?? '', weddingId ?? '', bookingId ?? ''),
    queryFn: async ({ signal }) => {
      const booking = unwrap(await getWeddingBooking(weddingId!, bookingId!, signal));
      if (!booking) {
        throw new QueryError({ code: 'not_found', message: 'Booking not found.' });
      }
      return booking;
    },
    enabled: Boolean(userId && weddingId && bookingId),
    staleTime: staleTimes.collaborative,
  });
}

export function usePayBooking(weddingId: string, bookingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { purpose?: PaymentPurpose; returnUrl?: string }) => {
      requireUser(userId);
      const checkout = unwrap(
        await initializeBookingCheckout({
          bookingId,
          purpose: input?.purpose,
          returnUrl: input?.returnUrl,
        }),
      );

      const result = await WebBrowser.openAuthSessionAsync(
        checkout.checkout_url,
        input?.returnUrl ?? `kiburan://weddings/${weddingId}/bookings/${bookingId}`,
      );

      const txRef = checkout.payment.tx_ref;
      if (txRef) {
        await verifyBookingCheckout(txRef);
      }

      return { checkout, browserResult: result };
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.weddingBooking(uid, weddingId, bookingId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingBookings(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgetItemsRoot(uid, weddingId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingBudget(uid, weddingId) });
    },
  });
}
