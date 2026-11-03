import { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useColors, useDecorations } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';

export type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
};

function createCardStyles(colors: AppColors, accentBorder: boolean) {
  return StyleSheet.create({
    base: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.lg,
      borderWidth: accentBorder ? 1 : StyleSheet.hairlineWidth,
      borderColor: accentBorder ? colors.primaryMuted : colors.border,
    },
    padded: {
      padding: spacing.lg,
    },
  });
}

export function Card({ padded = true, elevated = true, style, ...rest }: CardProps) {
  const colors = useColors();
  const decorations = useDecorations();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createCardStyles(colors, decorations.cardBorderAccent),
    [colors, decorations.cardBorderAccent],
  );

  return (
    <View
      style={[styles.base, padded && styles.padded, elevated && shadows.card, style]}
      {...rest}
    />
  );
}
