import { queryOptions } from '@tanstack/react-query';

import { listMyWeddings } from '@/features/weddings/services/weddingService';
import { unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

/** Kept free of auth imports so AuthContext can prefetch it without a module cycle. */
export function membershipsQuery(userId: string) {
  return queryOptions({
    queryKey: queryKeys.memberships(userId),
    queryFn: async () => unwrap(await listMyWeddings()),
    staleTime: staleTimes.wedding,
  });
}
