import { useGlobalSearchParams, useSegments } from 'expo-router';
import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';

import { useMyWeddings } from '@/features/weddings/queries';
import { defaultWeddingVisualStyle, getWeddingTheme } from '@/theme/palettes';
import type { AppColors, ThemeDecorations, WeddingTheme, WeddingVisualStyle } from '@/theme/types';
import { normalizeWeddingStyle } from '@/theme/weddingStyle';

type WeddingThemeContextValue = {
  theme: WeddingTheme;
  styleId: WeddingVisualStyle;
  colors: AppColors;
  decorations: ThemeDecorations;
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
  const segments = useSegments();
  const params = useGlobalSearchParams<{ weddingId?: string }>();
  const { memberships } = useMyWeddings();

  const routeWeddingId = params.weddingId ?? weddingIdFromSegments(segments as string[]);

  const persistedStyle = useMemo(() => {
    if (previewStyle) return previewStyle;
    if (routeWeddingId) {
      const match = memberships.find((m) => m.wedding_id === routeWeddingId);
      if (match?.wedding.style) return normalizeWeddingStyle(match.wedding.style);
    }
    const first = memberships[0]?.wedding.style;
    if (first) return normalizeWeddingStyle(first);
    return defaultWeddingVisualStyle;
  }, [previewStyle, routeWeddingId, memberships]);

  const value = useMemo((): WeddingThemeContextValue => {
    const theme = getWeddingTheme(persistedStyle);
    return {
      theme,
      styleId: theme.id,
      colors: theme.colors,
      decorations: theme.decorations,
    };
  }, [persistedStyle]);

  return (
    <WeddingThemeContext.Provider value={value}>{children}</WeddingThemeContext.Provider>
  );
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
