import { useMemo } from 'react';

import { useColors } from '@/theme/WeddingThemeContext';
import { createShadows } from '@/theme/shadows';
import type { AppColors } from '@/theme/types';

export function useThemedShadows() {
  const colors = useColors();
  return useMemo(() => createShadows(colors), [colors]);
}

export function useThemedStyles<T>(factory: (colors: AppColors) => T, deps: readonly unknown[] = []): T {
  const colors = useColors();
  void deps;
  return useMemo(() => factory(colors), [colors, factory]);
}
