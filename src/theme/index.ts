/**
 * Kiburan design system entry.
 * Prefer semantic tokens from this module over raw hex values in screens.
 */

import '@/global.css';

import { Platform } from 'react-native';

import { colors } from './colors';
import { radii } from './radii';
import { shadows } from './shadows';
import { spacing } from './spacing';
import { fontFamilies, textStyle, typography } from './typography';

export { colors } from './colors';
export type { ColorToken } from './colors';
export { radii } from './radii';
export type { RadiusToken } from './radii';
export { shadows } from './shadows';
export { spacing } from './spacing';
export type { SpacingToken } from './spacing';
export { fontFamilies, textStyle, typography } from './typography';
export type { TypographyVariant } from './typography';

/** @deprecated Prefer `colors` / `typography`. Kept for Expo template screens still in the repo. */
export const Colors = {
  light: {
    text: colors.text,
    background: colors.surface,
    backgroundElement: colors.surfaceMuted,
    backgroundSelected: colors.primaryMuted,
    textSecondary: colors.textMuted,
  },
  dark: {
    text: colors.textOnDark,
    background: '#121110',
    backgroundElement: '#2A2724',
    backgroundSelected: '#3A3531',
    textSecondary: '#B0AAA3',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** @deprecated Prefer `fontFamilies` / `typography`. */
export const Fonts = Platform.select({
  ios: {
    sans: fontFamilies.body,
    serif: fontFamilies.display,
    rounded: fontFamilies.body,
    mono: 'ui-monospace',
  },
  default: {
    sans: fontFamilies.body,
    serif: fontFamilies.display,
    rounded: fontFamilies.body,
    mono: 'monospace',
  },
  web: {
    sans: fontFamilies.body,
    serif: fontFamilies.display,
    rounded: fontFamilies.body,
    mono: 'ui-monospace',
  },
});

/** @deprecated Prefer `spacing`. */
export const Spacing = {
  half: spacing.xxs,
  one: spacing.xs,
  two: spacing.sm,
  three: spacing.lg,
  four: spacing.xl,
  five: spacing['2xl'],
  six: spacing['5xl'],
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const theme = {
  colors,
  spacing,
  radii,
  shadows,
  typography,
  fontFamilies,
  textStyle,
} as const;
