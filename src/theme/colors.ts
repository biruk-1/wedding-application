/**
 * Kiburan color tokens — tuned to the approved reference sheet.
 * See docs/design-tokens.md for notes when Figma exports exact values.
 */
export const colors = {
  surface: '#FDFBF7',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#F3EEE6',
  /** Champagne gold — primary CTAs (Get Started, Next, Add Guest) */
  primary: '#C5A36A',
  primaryPressed: '#B08F58',
  primaryMuted: '#EAD9B8',
  onPrimary: '#FFFFFF',
  /** Forest green — titles, progress, Save, active tab */
  success: '#2D4F36',
  successPressed: '#243F2C',
  successMuted: '#E3EBE5',
  onSuccess: '#FFFFFF',
  danger: '#C45B4A',
  dangerMuted: '#F8E9E6',
  onDanger: '#FFFFFF',
  warning: '#C47F2A',
  info: '#4A7A9B',
  infoMuted: '#E6F0F6',
  text: '#2D4F36',
  textMuted: '#6E746F',
  textSubtle: '#9AA19B',
  textOnDark: '#FFFFFF',
  border: '#E8E2D8',
  borderStrong: '#D4CBBC',
  overlay: 'rgba(28, 32, 28, 0.35)',
  overlayStrong: 'rgba(28, 32, 28, 0.62)',
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
