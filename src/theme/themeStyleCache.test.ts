import { describe, expect, it } from 'vitest';

import {
  buildThemeStyleCache,
  parseThemeStyleCache,
  resolveWeddingStyle,
  type ThemeStyleCache,
} from '@/theme/themeStyleCache';

const cache: ThemeStyleCache = {
  userId: 'u1',
  byWedding: { w1: 'traditional', w2: 'blend' },
  last: 'blend',
};

const membership = (id: string, style: string | null) => ({ wedding_id: id, wedding: { style } });

describe('resolveWeddingStyle', () => {
  it('prefers the onboarding preview', () => {
    expect(
      resolveWeddingStyle({ previewStyle: 'modern', routeWeddingId: 'w1', memberships: [], cache, fallback: 'modern' }),
    ).toBe('modern');
  });

  it('uses the cached style for the routed wedding before memberships load', () => {
    expect(resolveWeddingStyle({ routeWeddingId: 'w1', memberships: [], cache, fallback: 'modern' })).toBe(
      'traditional',
    );
  });

  it('lets server data override a stale cache', () => {
    expect(
      resolveWeddingStyle({
        routeWeddingId: 'w1',
        memberships: [membership('w1', 'modern')],
        cache,
        fallback: 'modern',
      }),
    ).toBe('modern');
  });

  it('falls back to the last cached style off wedding routes, then the default', () => {
    expect(resolveWeddingStyle({ memberships: [], cache, fallback: 'modern' })).toBe('blend');
    expect(resolveWeddingStyle({ memberships: [], cache: null, fallback: 'modern' })).toBe('modern');
  });

  it('maps the persisted "fusion" alias', () => {
    expect(
      resolveWeddingStyle({ routeWeddingId: 'w3', memberships: [membership('w3', 'fusion')], cache: null, fallback: 'modern' }),
    ).toBe('blend');
  });
});

describe('theme style cache serialization', () => {
  it('round-trips and rejects malformed values', () => {
    const built = buildThemeStyleCache('u1', [membership('w1', 'traditional'), membership('w2', null)], 'traditional');
    expect(built.byWedding).toEqual({ w1: 'traditional' });
    expect(parseThemeStyleCache(JSON.stringify(built))).toEqual(built);
    expect(parseThemeStyleCache('not json')).toBeNull();
    expect(parseThemeStyleCache(JSON.stringify({ byWedding: {} }))).toBeNull();
    expect(parseThemeStyleCache(null)).toBeNull();
  });
});
