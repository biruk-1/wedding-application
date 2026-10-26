import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

export const shadows = {
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
