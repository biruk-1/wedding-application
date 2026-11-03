import { Colors } from '@/theme';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { useColorScheme } from '@/theme/use-color-scheme';

/** Active wedding visual theme (colors + decorative tokens). */
export function useAppTheme() {
  return useWeddingTheme();
}

/** Legacy helper used by Expo template components. */
export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  return Colors[theme];
}
