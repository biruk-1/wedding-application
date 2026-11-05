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
  'accent',
  'accentMuted',
  'ornament',
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

/**
 * Which visual environment the shared layout components render. Each one has its own
 * background, ornament family, card treatment and navigation styling.
 */
export type ThemeEnvironment = 'modern' | 'traditional' | 'fusion';

export type ThemeDecorations = {
  environment: ThemeEnvironment;
  /** Tiled weave/grain texture drawn over the background gradient. */
  texture: number;
  textureOpacity: number;
  /**
   * Soft photographic wash behind the upper third of screens (fades into the surface).
   * Distinct from the inset dashboard hero card.
   */
  atmosphereImage: number;
  /** 0–1 opacity for the atmosphere photograph before the fade overlay. */
  atmosphereOpacity: number;
  backgroundGradient: readonly [string, string, string];
  cardRadius: number;
  buttonRadius: number;
  cardBorderAccent: boolean;
  sectionGoldLine: boolean;
  heroGradient: readonly [string, string, string];
  heroImage: number;
  dashboardHeroImage: number;
  /** Photography for vendor Discover / promotional banners. */
  discoverImage: number;
  /** Small, pre-cropped image for theme preview cards. */
  previewImage: number;
};

export type WeddingTheme = {
  id: WeddingVisualStyle;
  label: string;
  colors: AppColors;
  decorations: ThemeDecorations;
};
