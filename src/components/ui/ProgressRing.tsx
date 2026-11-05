import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { useColors, useDecorations } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

export type ProgressRingProps = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

/** Circular progress used on Tasks / Dashboard to match the reference UI. */
export function ProgressRing({
  percent,
  size = 88,
  strokeWidth = 8,
  label = 'Complete',
}: ProgressRingProps) {
  const colors = useColors();
  const env = useDecorations().environment;
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const track =
    env === 'traditional' ? colors.successMuted : env === 'fusion' ? colors.accentMuted : colors.surfaceMuted;
  const fill =
    env === 'traditional' ? colors.success : env === 'fusion' ? colors.accent : colors.primary;

  return (
    <View
      style={[styles.wrap, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fill}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap={env === 'traditional' ? 'butt' : 'round'}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <AppText variant="title" color="heading" style={styles.percent}>
          {clamped}%
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.label}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
  },
  percent: {
    fontSize: 20,
    lineHeight: 24,
  },
  label: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
});
