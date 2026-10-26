import { TextStyle } from 'react-native';

/** Loaded via @expo-google-fonts in app/_layout.tsx */
export const fontFamilies = {
  display: 'CormorantGaramond_600SemiBold',
  displayRegular: 'CormorantGaramond_400Regular',
  displayBold: 'CormorantGaramond_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

type TextVariant = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
};

export const typography = {
  brand: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: 0.6,
  },
  display: {
    fontFamily: fontFamilies.display,
    fontSize: 34,
    lineHeight: 40,
  },
  title: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    lineHeight: 32,
  },

  subtitle: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
} as const satisfies Record<string, TextVariant>;

export type TypographyVariant = keyof typeof typography;

export function textStyle(variant: TypographyVariant): TextStyle {
  return typography[variant];
}
