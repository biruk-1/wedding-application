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
    | 'accent'
    | 'accentMuted'
    | 'ornament'
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

const MODERN_HERO = require('../../assets/themes/modern/wedding-images/hero.jpg') as number;
const MODERN_PREVIEW = require('../../assets/themes/modern/wedding-images/preview.jpg') as number;
const MODERN_ATMOSPHERE = require('../../assets/themes/modern/wedding-images/atmosphere.jpg') as number;
const MODERN_TEXTURE = require('../../assets/themes/modern/textures/paper-grain.png') as number;
const TRADITIONAL_HERO = require('../../assets/themes/traditional/wedding-images/hero.jpg') as number;
const TRADITIONAL_PREVIEW = require('../../assets/themes/traditional/wedding-images/preview.jpg') as number;
const TRADITIONAL_ATMOSPHERE =
  require('../../assets/themes/traditional/wedding-images/atmosphere.jpg') as number;
const TRADITIONAL_TEXTURE = require('../../assets/themes/traditional/textures/shamma-weave.png') as number;
const FUSION_HERO = require('../../assets/themes/fusion/wedding-images/hero.jpg') as number;
const FUSION_PREVIEW = require('../../assets/themes/fusion/wedding-images/preview.jpg') as number;
const FUSION_ATMOSPHERE = require('../../assets/themes/fusion/wedding-images/atmosphere.jpg') as number;
const FUSION_TEXTURE = require('../../assets/themes/fusion/textures/linen.png') as number;

/** Full-bleed portrait for the signed-out welcome screen (before any wedding style exists). */
export const WELCOME_PORTRAIT = require('../../assets/themes/traditional/wedding-images/portrait.jpg') as number;

/** Ivory, champagne gold and forest green: soft gradients, hairlines, open space. */
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
    accent: '#315B48',
    accentMuted: '#E3EBE5',
    ornament: '#C6A064',
    text: '#292B29',
    heading: '#315B48',
    textMuted: '#77736D',
    textSubtle: '#9A958E',
    border: '#E8E2D8',
    borderStrong: '#D4CBBC',
  }),
  decorations: {
    environment: 'modern',
    texture: MODERN_TEXTURE,
    textureOpacity: 1,
    atmosphereImage: MODERN_ATMOSPHERE,
    atmosphereOpacity: 0.4,
    backgroundGradient: ['#FBF9F5', '#F8F5EF', '#EFE6D8'],
    cardRadius: 18,
    buttonRadius: 999,
    cardBorderAccent: false,
    sectionGoldLine: false,
    heroGradient: ['rgba(20,24,20,0.28)', 'rgba(20,24,20,0.06)', 'rgba(20,24,20,0.48)'],
    heroImage: MODERN_HERO,
    dashboardHeroImage: MODERN_HERO,
    discoverImage: MODERN_HERO,
    previewImage: MODERN_PREVIEW,
  },
};

/** Shamma cotton with tibeb borders: deep green, gold, burgundy and terracotta at the edges. */
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
    accent: '#762F3D',
    accentMuted: '#F0DCDC',
    ornament: '#A85C3D',
    text: '#49362B',
    heading: '#244B37',
    textMuted: '#6B5648',
    textSubtle: '#8E796A',
    border: '#D9C4A8',
    borderStrong: '#C4A882',
  }),
  decorations: {
    environment: 'traditional',
    texture: TRADITIONAL_TEXTURE,
    textureOpacity: 0.55,
    atmosphereImage: TRADITIONAL_ATMOSPHERE,
    atmosphereOpacity: 0.48,
    backgroundGradient: ['#F6EDDD', '#F3E8D5', '#EADBC3'],
    cardRadius: 12,
    buttonRadius: 12,
    cardBorderAccent: true,
    sectionGoldLine: true,
    heroGradient: ['rgba(28,40,30,0.35)', 'rgba(28,40,30,0.08)', 'rgba(28,40,30,0.52)'],
    heroImage: TRADITIONAL_HERO,
    dashboardHeroImage: TRADITIONAL_HERO,
    discoverImage: TRADITIONAL_HERO,
    previewImage: TRADITIONAL_PREVIEW,
  },
};

/** Modern cream surfaces with a single tibeb accent, antique gold framing and wine highlights. */
export const fusionEthiopianTheme: WeddingTheme = {
  id: 'blend',
  label: 'Ethiopian Fusion',
  colors: palette({
    surface: '#F7F2E9',
    surfaceElevated: '#FFFDF9',
    surfaceMuted: '#EDE3D3',
    primary: '#B99150',
    primaryPressed: '#A07D42',
    primaryMuted: '#E8D8BA',
    success: '#355744',
    successPressed: '#2A4637',
    successMuted: '#DFE8E1',
    accent: '#81434B',
    accentMuted: '#F2E2E1',
    ornament: '#AA7953',
    text: '#2E2A27',
    heading: '#355744',
    textMuted: '#74695F',
    textSubtle: '#9A8F84',
    border: '#E4D9C8',
    borderStrong: '#CDBDA5',
  }),
  decorations: {
    environment: 'fusion',
    texture: FUSION_TEXTURE,
    textureOpacity: 0.85,
    atmosphereImage: FUSION_ATMOSPHERE,
    atmosphereOpacity: 0.43,
    backgroundGradient: ['#FAF6EF', '#F7F2E9', '#F0E6D8'],
    cardRadius: 16,
    buttonRadius: 999,
    cardBorderAccent: false,
    sectionGoldLine: true,
    heroGradient: ['rgba(40,28,30,0.32)', 'rgba(40,28,30,0.06)', 'rgba(40,28,30,0.55)'],
    heroImage: FUSION_HERO,
    dashboardHeroImage: FUSION_HERO,
    discoverImage: FUSION_HERO,
    previewImage: FUSION_PREVIEW,
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

export type { ThemeDecorations };
