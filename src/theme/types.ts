export type WeddingVisualStyle = 'modern' | 'traditional' | 'blend';

export const semanticColorTokens = [
  'surface',
  'surfaceElevated',
  'surfaceMuted',
  'primary',
  'primaryPressed',
  'primaryMuted',
  'onPrimary',
  'success',
  'successPressed',
  'successMuted',
  'onSuccess',
  'danger',
  'dangerMuted',
  'onDanger',
  'warning',
  'info',
  'infoMuted',
  'text',
  'heading',
  'textMuted',
  'textSubtle',
  'textOnDark',
  'border',
  'borderStrong',
  'overlay',
  'overlayStrong',
  'transparent',
] as const;

export type ColorToken = (typeof semanticColorTokens)[number];

export type AppColors = Record<ColorToken, string>;

export type ThemeDecorations = {
  backdropPatternOpacity: number;
  cardBorderAccent: boolean;
  sectionGoldLine: boolean;
  heroGradient: readonly [string, string, string];
  heroImage: number;
  dashboardHeroImage: number;
};

export type WeddingTheme = {
  id: WeddingVisualStyle;
  label: string;
  colors: AppColors;
  decorations: ThemeDecorations;
};
