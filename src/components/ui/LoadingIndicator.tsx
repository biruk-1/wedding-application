import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type LoadingIndicatorProps = ViewProps & {
  label?: string;
  color?: string;
  size?: 'small' | 'large';
};

export function LoadingIndicator({
  label,
  color = colors.primary,
  size = 'large',
  style,
  ...rest
}: LoadingIndicatorProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
      style={[styles.container, style]}
      {...rest}>
      <ActivityIndicator color={color} size={size} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
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
    color: colors.textMuted,
  },
});
