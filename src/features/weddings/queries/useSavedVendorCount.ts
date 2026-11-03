import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/weddings/queries';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';
import { supabase } from '@/lib/supabase';

export function useSavedVendorCount(weddingId: string | undefined) {
  const userId = useUserId();
  const query = useQuery({
    queryKey: [...queryKeys.wedding(userId ?? '', weddingId ?? ''), 'saved-vendor-count'] as const,
    queryFn: async ({ signal }) => {
      let request = supabase
        .from('wedding_vendors')
        .select('id', { count: 'exact', head: true })
        .eq('wedding_id', weddingId!);
      if (signal) request = request.abortSignal(signal);
      const { count, error } = await request;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });

  return {
    count: query.data ?? 0,
    isLoading: query.isPending,
  };
}
