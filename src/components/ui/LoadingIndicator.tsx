import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type LoadingIndicatorProps = ViewProps & {
  label?: string;
  color?: string;
  size?: 'small' | 'large';
};

export function LoadingIndicator({
  label,
  color,
  size = 'large',
  style,
  ...rest
}: LoadingIndicatorProps) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={[styles.container, style]}
      {...rest}>
      <ActivityIndicator color={color ?? colors.primary} size={size} />
      {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  label: {
    ...typography.caption,
  },
});
