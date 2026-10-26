import { colors } from '@/theme/colors';
import { Colors } from '@/theme';
import { useColorScheme } from '@/theme/use-color-scheme';

/** Semantic Kiburan palette (light-first; dark unused until design defines it). */
export function useAppTheme() {
  return colors;
}

/** Legacy helper used by Expo template components. */
export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  return Colors[theme];
}
