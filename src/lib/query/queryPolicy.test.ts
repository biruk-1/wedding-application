import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { syncCacheOwner } from '@/lib/query/cacheOwner';
import {
  MAX_QUERY_RETRIES,
  QueryError,
  isRetryableError,
  retryDelay,
  shouldRetryQuery,
  transportErrorCode,
  unwrap,
} from '@/lib/query/queryError';
import { queryKeys } from '@/lib/query/queryKeys';

describe('query keys', () => {
  it('scopes every key to the signed-in user', () => {
    const keys = [
      queryKeys.memberships('a'),
      queryKeys.wedding('a', 'w'),
      queryKeys.tasks('a', 'w'),
      queryKeys.task('a', 'w', 't'),
      queryKeys.taskComments('a', 'w', 't'),
      queryKeys.weddingMembers('a', 'w'),
      queryKeys.myAccess('a', 'w'),
      queryKeys.teamMembers('a', 'w'),
      queryKeys.weddingVendor('a', 'w', 'v'),
      queryKeys.taskCategories('a'),
      queryKeys.checklistTemplateCount('a'),
      queryKeys.vendorCategories('a'),
      queryKeys.vendorCities('a'),
      queryKeys.vendorProfile('a', 'v'),
      queryKeys.vendorList('a', {
        query: '',
        categoryId: null,
        city: null,
        minPrice: null,
        maxPrice: null,
        queryCategoryIds: [],
      }),
    ];
    for (const key of keys) expect(key.slice(0, 2)).toEqual(['u', 'a']);
  });

  it('never shares a cache entry between two users', () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.wedding('user-a', 'w1'), { title: 'A private wedding' });
    expect(client.getQueryData(queryKeys.wedding('user-b', 'w1'))).toBeUndefined();
  });
});

describe('cache ownership', () => {
  it('clears cached data on sign-out and on account switch', () => {
    const client = new QueryClient();
    let owner = syncCacheOwner(client, null, 'user-a');
    client.setQueryData(queryKeys.memberships('user-a'), [{ wedding_id: 'w1' }]);

    owner = syncCacheOwner(client, owner, 'user-a');
    expect(client.getQueryData(queryKeys.memberships('user-a'))).toBeDefined();

    owner = syncCacheOwner(client, owner, null);
    expect(owner).toBeNull();
    expect(client.getQueryCache().getAll()).toHaveLength(0);

    owner = syncCacheOwner(client, owner, 'user-b');
    client.setQueryData(queryKeys.memberships('user-b'), []);
    owner = syncCacheOwner(client, owner, 'user-c');
    expect(owner).toBe('user-c');
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe('retry policy', () => {
  it('retries only transient transport failures, a bounded number of times', () => {
    const network = new QueryError({ code: 'network', message: 'Network error' });
    const forbidden = new QueryError({ code: 'forbidden', message: 'No access' });

    expect(isRetryableError(network)).toBe(true);
    expect(isRetryableError({ code: 'timeout' })).toBe(true);
    expect(isRetryableError(forbidden)).toBe(false);
    expect(isRetryableError(new Error('boom'))).toBe(false);

    expect(shouldRetryQuery(0, network)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, network)).toBe(false);
    expect(shouldRetryQuery(0, forbidden)).toBe(false);
  });

  it('backs off exponentially with a cap', () => {
    expect([0, 1, 2, 3, 4, 10].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
  });

  it('turns failed results into thrown errors instead of empty success', () => {
    expect(unwrap({ ok: true, data: 1 })).toBe(1);
    expect(() => unwrap({ ok: false, error: { code: 'forbidden', message: 'No access' } })).toThrow(
      QueryError,
    );
  });

  it('classifies transport errors', () => {
    expect(transportErrorCode(null)).toBeNull();
    expect(transportErrorCode({ name: 'RequestTimeoutError', message: 'Request timed out' })).toBe('timeout');
    expect(transportErrorCode(new TypeError('Network request failed'))).toBe('network');
    expect(transportErrorCode({ message: 'TypeError: Failed to fetch' })).toBe('network');
    expect(transportErrorCode({ code: '42501', message: 'new row violates row-level security' })).toBeNull();
  });
});
