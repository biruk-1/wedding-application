import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AppColors } from '@/theme/types';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

export type BadgeProps = ViewProps & {
  label: string;
  tone?: BadgeTone;
};

function toneStyles(colors: AppColors): Record<BadgeTone, { background: string; text: string }> {
  return {
    neutral: { background: colors.surfaceMuted, text: colors.textMuted },
    success: { background: colors.successMuted, text: colors.success },
    warning: { background: colors.primaryMuted, text: colors.warning },
    danger: { background: colors.dangerMuted, text: colors.danger },
    info: { background: colors.infoMuted, text: colors.info },
    primary: { background: colors.primaryMuted, text: colors.primaryPressed },
  };
}

export function Badge({ label, tone = 'neutral', style, ...rest }: BadgeProps) {
  const colors = useColors();
  const palette = useMemo(() => toneStyles(colors)[tone], [colors, tone]);

  return (
    <View
      accessibilityRole="text"
      style={[styles.base, { backgroundColor: palette.background }, style]}
      {...rest}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontFamily: typography.label.fontFamily,
  },
});
