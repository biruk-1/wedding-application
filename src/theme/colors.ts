/**
 * Semantic color tokens for Kiburan.
 * Prefer `useColors()` from `@/theme/WeddingThemeContext` in UI code so the active wedding style applies.
 */
import { modernEthiopianTheme } from '@/theme/palettes';
import type { AppColors } from '@/theme/types';

export type { ColorToken } from '@/theme/types';

/** Static default (Modern Ethiopian) — tests and non-React modules only. */
export const colors: AppColors = { ...modernEthiopianTheme.colors };
