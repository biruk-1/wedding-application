import { Platform, ViewStyle } from 'react-native';

import { modernEthiopianTheme } from '@/theme/palettes';
import type { AppColors } from '@/theme/types';

export function createShadows(colors: AppColors) {
  return {
    none: {} as ViewStyle,
    soft: Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.text,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 2 },
      default: {
        shadowColor: colors.text,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
    })!,
    card: Platform.select<ViewStyle>({
      ios: {
        shadowColor: colors.text,
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
      default: {
        shadowColor: colors.text,
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
    })!,
  } as const;
}

/** @deprecated Use `createShadows(useColors())` in components. */
export const shadows = createShadows(modernEthiopianTheme.colors);

export type ShadowToken = keyof ReturnType<typeof createShadows>;
