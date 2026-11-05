import type { WeddingVisualStyle } from '@/theme/types';
import { normalizeWeddingStyle } from '@/theme/weddingStyleIds';

export const THEME_STYLE_CACHE_KEY = 'kiburan.weddingStyle.v1';

/** Last known style per wedding, scoped to the signed-in user. Contains no wedding content. */
export type ThemeStyleCache = {
  userId: string;
  byWedding: Record<string, WeddingVisualStyle>;
  last: WeddingVisualStyle | null;
};

export function parseThemeStyleCache(raw: string | null): ThemeStyleCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ThemeStyleCache>;
    if (typeof value.userId !== 'string' || !value.byWedding || typeof value.byWedding !== 'object') {
      return null;
    }
    const byWedding: Record<string, WeddingVisualStyle> = {};
    for (const [id, style] of Object.entries(value.byWedding)) {
      if (typeof style === 'string') byWedding[id] = normalizeWeddingStyle(style);
    }
    return {
      userId: value.userId,
      byWedding,
      last: typeof value.last === 'string' ? normalizeWeddingStyle(value.last) : null,
    };
  } catch {
    return null;
  }
}

type Membership = { wedding_id: string; wedding: { style: string | null } };

export type ResolveStyleInput = {
  previewStyle?: WeddingVisualStyle | null;
  routeWeddingId?: string;
  memberships: readonly Membership[];
  cache: ThemeStyleCache | null;
  fallback: WeddingVisualStyle;
};

/**
 * Order: explicit preview → server style for the routed wedding → cached style for that wedding →
 * first membership → last cached style → fallback. The cache only bridges the gap before the
 * memberships query resolves; server data always wins once present.
 */
export function resolveWeddingStyle({
  previewStyle,
  routeWeddingId,
  memberships,
  cache,
  fallback,
}: ResolveStyleInput): WeddingVisualStyle {
  if (previewStyle) return previewStyle;
  if (routeWeddingId) {
    const match = memberships.find((m) => m.wedding_id === routeWeddingId);
    if (match?.wedding.style) return normalizeWeddingStyle(match.wedding.style);
    const cached = cache?.byWedding[routeWeddingId];
    if (cached && !match) return cached;
  }
  const first = memberships[0]?.wedding.style;
  if (first) return normalizeWeddingStyle(first);
  if (memberships.length === 0 && cache?.last) return cache.last;
  return fallback;
}

export function buildThemeStyleCache(
  userId: string,
  memberships: readonly Membership[],
  activeStyle: WeddingVisualStyle,
): ThemeStyleCache {
  const byWedding: Record<string, WeddingVisualStyle> = {};
  for (const m of memberships) {
    if (m.wedding.style) byWedding[m.wedding_id] = normalizeWeddingStyle(m.wedding.style);
  }
  return { userId, byWedding, last: activeStyle };
}
