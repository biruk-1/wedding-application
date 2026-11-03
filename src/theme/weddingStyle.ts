import { getWeddingTheme } from '@/theme/palettes';
import type { WeddingVisualStyle, WeddingTheme } from '@/theme/types';
import { normalizeWeddingStyle } from '@/theme/weddingStyleIds';

export { normalizeWeddingStyle } from '@/theme/weddingStyleIds';

export function resolveWeddingTheme(raw: string | null | undefined): WeddingTheme {
  return getWeddingTheme(normalizeWeddingStyle(raw));
}

export function weddingStyleLabel(style: WeddingVisualStyle): string {
  switch (style) {
    case 'modern':
      return 'Modern Ethiopian';
    case 'traditional':
      return 'Traditional Ethiopian';
    case 'blend':
      return 'Ethiopian Fusion';
    default:
      return 'Modern Ethiopian';
  }
}
