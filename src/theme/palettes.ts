import type { AppColors, ThemeDecorations, WeddingTheme, WeddingVisualStyle } from '@/theme/types';

// Image requires must stay in this module (not imported by Vitest unit tests).

function palette(
  partial: Pick<
    AppColors,
    | 'surface'
    | 'surfaceElevated'
    | 'surfaceMuted'
    | 'primary'
    | 'primaryPressed'
    | 'primaryMuted'
    | 'success'
    | 'successPressed'
    | 'successMuted'
    | 'text'
    | 'heading'
    | 'textMuted'
    | 'textSubtle'
    | 'border'
    | 'borderStrong'
  >,
): AppColors {
  return {
    ...partial,
    onPrimary: '#FFFFFF',
    onSuccess: '#FFFFFF',
    danger: '#C45B4A',
    dangerMuted: '#F8E9E6',
    onDanger: '#FFFFFF',
    warning: '#C47F2A',
    info: '#4A7A9B',
    infoMuted: '#E6F0F6',
    textOnDark: '#FFFFFF',
    overlay: 'rgba(28, 32, 28, 0.35)',
    overlayStrong: 'rgba(28, 32, 28, 0.62)',
    transparent: 'transparent',
  };
}

const HERO_MODERN = require('../../assets/images/style-modern.jpg') as number;
const HERO_TRADITIONAL = require('../../assets/images/style-traditional.jpg') as number;
const HERO_BLEND = require('../../assets/images/style-blend.jpg') as number;
const WELCOME_HERO = require('../../assets/images/welcome-hero.jpg') as number;

export const modernEthiopianTheme: WeddingTheme = {
  id: 'modern',
  label: 'Modern Ethiopian',
  colors: palette({
    surface: '#F8F5EF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#E9DFD0',
    primary: '#C6A064',
    primaryPressed: '#B08F58',
    primaryMuted: '#EAD9B8',
    success: '#315B48',
    successPressed: '#274A3A',
    successMuted: '#E3EBE5',
    text: '#292B29',
    heading: '#315B48',
    textMuted: '#77736D',
    textSubtle: '#9A958E',
    border: '#E8E2D8',
    borderStrong: '#D4CBBC',
  }),
  decorations: {
    backdropPatternOpacity: 0,
    cardBorderAccent: false,
    sectionGoldLine: false,
    heroGradient: ['rgba(20,24,20,0.04)', 'rgba(20,24,20,0.28)', 'rgba(20,24,20,0.72)'],
    heroImage: WELCOME_HERO,
    dashboardHeroImage: HERO_MODERN,
  },
};

export const traditionalEthiopianTheme: WeddingTheme = {
  id: 'traditional',
  label: 'Traditional Ethiopian',
  colors: palette({
    surface: '#F3E8D5',
    surfaceElevated: '#FBF4E8',
    surfaceMuted: '#E8D9C4',
    primary: '#C69A45',
    primaryPressed: '#AD8538',
    primaryMuted: '#EDD9B0',
    success: '#244B37',
    successPressed: '#1C3B2C',
    successMuted: '#D9E6DE',
    text: '#49362B',
    heading: '#244B37',
    textMuted: '#6B5648',
    textSubtle: '#8E796A',
    border: '#D9C4A8',
    borderStrong: '#C4A882',
  }),
  decorations: {
    backdropPatternOpacity: 0.06,
    cardBorderAccent: true,
    sectionGoldLine: true,
    heroGradient: ['rgba(36,75,55,0.08)', 'rgba(36,75,55,0.38)', 'rgba(36,75,55,0.82)'],
    heroImage: HERO_TRADITIONAL,
    dashboardHeroImage: HERO_TRADITIONAL,
  },
};

export const fusionEthiopianTheme: WeddingTheme = {
  id: 'blend',
  label: 'Ethiopian Fusion',
  colors: palette({
    surface: '#F8F5EF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#EDE4D6',
    primary: '#C6A064',
    primaryPressed: '#B08F58',
    primaryMuted: '#EAD9B8',
    success: '#315B48',
    successPressed: '#274A3A',
    successMuted: '#E3EBE5',
    text: '#292B29',
    heading: '#315B48',
    textMuted: '#77736D',
    textSubtle: '#9A958E',
    border: '#E8E2D8',
    borderStrong: '#D4CBBC',
  }),
  decorations: {
    backdropPatternOpacity: 0.035,
    cardBorderAccent: true,
    sectionGoldLine: true,
    heroGradient: ['rgba(20,24,20,0.05)', 'rgba(118,47,61,0.22)', 'rgba(20,24,20,0.75)'],
    heroImage: HERO_BLEND,
    dashboardHeroImage: HERO_BLEND,
  },
};

export const weddingThemes: Record<WeddingVisualStyle, WeddingTheme> = {
  modern: modernEthiopianTheme,
  traditional: traditionalEthiopianTheme,
  blend: fusionEthiopianTheme,
};

export const defaultWeddingVisualStyle: WeddingVisualStyle = 'modern';

export function getWeddingTheme(style: WeddingVisualStyle): WeddingTheme {
  return weddingThemes[style];
}

/** Burgundy / terracotta accents for traditional decorative overlays (not used as large fills). */
export const traditionalAccentColors = {
  burgundy: '#762F3D',
  terracotta: '#A85C3D',
} as const;

export type { ThemeDecorations };
