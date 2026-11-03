import type { WeddingVisualStyle } from '@/theme/types';

const STYLE_ALIASES: Record<string, WeddingVisualStyle> = {
  modern: 'modern',
  traditional: 'traditional',
  blend: 'blend',
  fusion: 'blend',
};

/** Maps persisted `weddings.style` to a visual theme id. */
export function normalizeWeddingStyle(raw: string | null | undefined): WeddingVisualStyle {
  if (!raw) return 'modern';
  const key = raw.trim().toLowerCase();
  return STYLE_ALIASES[key] ?? 'modern';
}
