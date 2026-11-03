import type { QueryClient } from '@tanstack/react-query';

/**
 * Drops every cached query when the signed-in account changes (sign-out, or a different user
 * signing in), so no private wedding data outlives the session that was allowed to read it.
 * Returns the new owner id. The first sign-in after a cold start keeps the (empty) cache.
 */
export function syncCacheOwner(
  queryClient: QueryClient,
  currentOwner: string | null,
  nextOwner: string | null,
): string | null {
  if (currentOwner === nextOwner) return currentOwner;
  if (currentOwner !== null) {
    void queryClient.cancelQueries();
    queryClient.clear();
  }
  return nextOwner;
}
