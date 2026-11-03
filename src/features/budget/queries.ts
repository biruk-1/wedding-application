import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  createBudgetItem,
  createPayment,
  deleteBudgetItem,
  deletePayment,
  getBudgetItem,
  getWeddingBudget,
  listBudgetCategories,
  listBudgetItemSummaries,
  listBudgetItems,
  listWeddingVendorOptions,
  updateBudgetItem,
  updateWeddingBudget,
} from '@/features/budget/services/budgetService';
import type {
  BudgetItemInput,
  BudgetItemListItem,
  BudgetServerFilters,
  PaymentInput,
  WeddingBudgetUpdate,
} from '@/features/budget/types';
import {
  buildCategoryBreakdown,
  computeBudgetSummary,
} from '@/features/budget/utils/budgetHelpers';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

const SEARCH_DEBOUNCE_MS = 250;
const EMPTY_ITEMS: BudgetItemListItem[] = [];

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

function invalidateBudget(queryClient: ReturnType<typeof useQueryClient>, userId: string, weddingId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.weddingBudget(userId, weddingId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.budgetItemsRoot(userId, weddingId) });
}

export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

export function useBudgetCategories() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.budgetCategories(userId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listBudgetCategories(signal)),
    enabled: Boolean(userId),
    staleTime: staleTimes.reference,
  });
}

export function useWeddingBudget(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingBudget(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await getWeddingBudget(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useBudgetItemSummaries(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.budgetItemSummaries(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listBudgetItemSummaries(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

/** Combined dashboard numbers from budget header + item summaries (no second payment fetch). */
export function useBudgetDashboard(weddingId: string | undefined) {
  const budgetQuery = useWeddingBudget(weddingId);
  const itemsQuery = useBudgetItemSummaries(weddingId);

  const summary = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const payments = items.flatMap((item) =>
      // paid_total is already aggregated; rebuild payment rows for outstanding math
      item.paid_total > 0
        ? [{ budget_item_id: item.id, amount: item.paid_total }]
        : [],
    );
    return computeBudgetSummary(
      budgetQuery.data,
      items.map((item) => ({
        id: item.id,
        estimated_amount: item.estimated_amount,
        committed_amount: item.committed_amount,
      })),
      payments,
    );
  }, [budgetQuery.data, itemsQuery.data]);

  const categories = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const payments = items.flatMap((item) =>
      item.paid_total > 0 ? [{ budget_item_id: item.id, amount: item.paid_total }] : [],
    );
    return buildCategoryBreakdown(
      items.map((item) => ({
        id: item.id,
        category_id: item.category_id,
        estimated_amount: item.estimated_amount,
        committed_amount: item.committed_amount,
        category: item.category,
      })),
      payments,
    );
  }, [itemsQuery.data]);

  return {
    budget: budgetQuery.data,
    items: itemsQuery.data ?? EMPTY_ITEMS,
    summary,
    categories,
    isPending: budgetQuery.isPending || itemsQuery.isPending,
    isError: (budgetQuery.isError && !budgetQuery.data) || (itemsQuery.isError && !itemsQuery.data),
    error: budgetQuery.error ?? itemsQuery.error,
    isRefetching: budgetQuery.isRefetching || itemsQuery.isRefetching,
    isRefetchError: budgetQuery.isRefetchError || itemsQuery.isRefetchError,
    refetch: () => {
      void budgetQuery.refetch();
      void itemsQuery.refetch();
    },
  };
}

export function useBudgetItemList(
  weddingId: string | undefined,
  filters: { query: string; categoryId: string | null },
) {
  const userId = useUserId();
  const debouncedQuery = useDebouncedValue(filters.query.trim());
  const serverFilters = useMemo<BudgetServerFilters>(
    () => ({ query: debouncedQuery, categoryId: filters.categoryId }),
    [debouncedQuery, filters.categoryId],
  );

  const query = useInfiniteQuery({
    queryKey: queryKeys.budgetItems(userId ?? '', weddingId ?? '', serverFilters),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await listBudgetItems(weddingId!, serverFilters, pageParam, signal)),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.hasMore ? lastPageParam + 40 : undefined,
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
    placeholderData: keepPreviousData,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? EMPTY_ITEMS,
    [query.data],
  );

  return {
    items,
    isLoading: query.isPending,
    isUpdating: query.isPlaceholderData || filters.query.trim() !== debouncedQuery,
    error: query.data ? null : query.error,
    refreshError: query.data && query.isRefetchError ? query.error : null,
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refresh: () => void query.refetch(),
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => void query.fetchNextPage(),
  };
}

export function useBudgetItem(weddingId: string | undefined, itemId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.budgetItem(userId ?? '', weddingId ?? '', itemId ?? ''),
    queryFn: async ({ signal }) => unwrap(await getBudgetItem(weddingId!, itemId!, signal)),
    enabled: Boolean(userId && weddingId && itemId),
    staleTime: staleTimes.collaborative,
  });
}

export function useBudgetVendorOptions(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.budgetVendorOptions(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingVendorOptions(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useUpdateWeddingBudget(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WeddingBudgetUpdate) => {
      requireUser(userId);
      return unwrap(await updateWeddingBudget(weddingId, input));
    },
    onSuccess: () => invalidateBudget(queryClient, requireUser(userId), weddingId),
  });
}

export function useSaveBudgetItem(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { mode: 'create'; values: BudgetItemInput } | { mode: 'edit'; itemId: string; values: BudgetItemInput },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createBudgetItem(weddingId, input.values)
          : await updateBudgetItem(weddingId, input.itemId, input.values),
      );
    },
    onSuccess: (item) => {
      const uid = requireUser(userId);
      invalidateBudget(queryClient, uid, weddingId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgetItem(uid, weddingId, item.id),
      });
    },
  });
}

export function useDeleteBudgetItem(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      requireUser(userId);
      return unwrap(await deleteBudgetItem(weddingId, itemId));
    },
    onSuccess: () => invalidateBudget(queryClient, requireUser(userId), weddingId),
  });
}

export function useRecordPayment(weddingId: string, itemId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentInput) => {
      const uid = requireUser(userId);
      return unwrap(await createPayment(weddingId, itemId, input, uid));
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      invalidateBudget(queryClient, uid, weddingId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgetItem(uid, weddingId, itemId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.budgetPayments(uid, weddingId, itemId),
      });
    },
  });
}

export function useDeletePayment(weddingId: string, itemId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      requireUser(userId);
      return unwrap(await deletePayment(weddingId, itemId, paymentId));
    },
    onSuccess: () => {
      const uid = requireUser(userId);
      invalidateBudget(queryClient, uid, weddingId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.budgetItem(uid, weddingId, itemId) });
    },
  });
}
