import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalSearchParams, useSegments } from 'expo-router';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyWeddings } from '@/features/weddings/queries';
import { defaultWeddingVisualStyle, getWeddingTheme } from '@/theme/palettes';
import {
  THEME_STYLE_CACHE_KEY,
  buildThemeStyleCache,
  parseThemeStyleCache,
  resolveWeddingStyle,
  type ThemeStyleCache,
} from '@/theme/themeStyleCache';
import type { AppColors, ThemeDecorations, WeddingTheme, WeddingVisualStyle } from '@/theme/types';

type WeddingThemeContextValue = {
  theme: WeddingTheme;
  styleId: WeddingVisualStyle;
  colors: AppColors;
  decorations: ThemeDecorations;
  /** False until the cached style has been read; the splash screen stays up until then. */
  isHydrated: boolean;
};

const WeddingThemeContext = createContext<WeddingThemeContextValue | null>(null);

export type WeddingThemeProviderProps = {
  children: ReactNode;
  /** When set, overrides route / membership resolution (e.g. onboarding style preview). */
  previewStyle?: WeddingVisualStyle | null;
};

function weddingIdFromSegments(segments: string[]): string | undefined {
  const idx = segments.indexOf('weddings');
  if (idx === -1) return undefined;
  const candidate = segments[idx + 1];
  if (!candidate || candidate.startsWith('[')) return undefined;
  return candidate;
}

export function WeddingThemeProvider({ children, previewStyle }: WeddingThemeProviderProps) {
  const parent = useContext(WeddingThemeContext);
  const segments = useSegments();
  const params = useGlobalSearchParams<{ weddingId?: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { memberships } = useMyWeddings();
  const userId = user?.id ?? null;
  const isRoot = parent === null;

  const [cache, setCache] = useState<ThemeStyleCache | null>(null);
  const [isHydrated, setHydrated] = useState(!isRoot);
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (!isRoot) return;
    let cancelled = false;
    AsyncStorage.getItem(THEME_STYLE_CACHE_KEY)
      .then((raw) => {
        if (cancelled) return;
        lastWritten.current = raw;
        setCache(parseThemeStyleCache(raw));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isRoot]);

  const routeWeddingId = params.weddingId ?? weddingIdFromSegments(segments as string[]);
  const userCache = cache && (authLoading || cache.userId === userId) ? cache : null;

  const styleId = useMemo(
    () =>
      parent && !previewStyle
        ? parent.styleId
        : resolveWeddingStyle({
            previewStyle,
            routeWeddingId,
            memberships,
            cache: userCache,
            fallback: defaultWeddingVisualStyle,
          }),
    [parent, previewStyle, routeWeddingId, memberships, userCache],
  );

  useEffect(() => {
    if (!isRoot || !isHydrated || authLoading) return;
    if (!userId) {
      if (lastWritten.current !== null) {
        lastWritten.current = null;
        void AsyncStorage.removeItem(THEME_STYLE_CACHE_KEY).catch(() => undefined);
      }
      return;
    }
    if (memberships.length === 0) return;
    const next = JSON.stringify(buildThemeStyleCache(userId, memberships, styleId));
    if (next === lastWritten.current) return;
    lastWritten.current = next;
    void AsyncStorage.setItem(THEME_STYLE_CACHE_KEY, next).catch(() => undefined);
  }, [isRoot, isHydrated, authLoading, userId, memberships, styleId]);

  const value = useMemo((): WeddingThemeContextValue => {
    const theme = getWeddingTheme(styleId);
    return {
      theme,
      styleId: theme.id,
      colors: theme.colors,
      decorations: theme.decorations,
      isHydrated: parent ? parent.isHydrated : isHydrated,
    };
  }, [styleId, parent, isHydrated]);

  return <WeddingThemeContext.Provider value={value}>{children}</WeddingThemeContext.Provider>;
}

function useWeddingThemeContext(): WeddingThemeContextValue {
  const ctx = useContext(WeddingThemeContext);
  if (ctx) return ctx;
  const theme = getWeddingTheme(defaultWeddingVisualStyle);
  return {
    theme,
    styleId: theme.id,
    colors: theme.colors,
    decorations: theme.decorations,
    isHydrated: true,
  };
}

export function useWeddingTheme(): WeddingThemeContextValue {
  return useWeddingThemeContext();
}

export function useColors(): AppColors {
  return useWeddingThemeContext().colors;
}

export function useDecorations(): ThemeDecorations {
  return useWeddingThemeContext().decorations;
}
