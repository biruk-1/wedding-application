import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useColors } from '@/theme/WeddingThemeContext';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width = '100%',
  height = 16,
  radius = radii.md,
  style,
}: SkeletonProps) {
  const colors = useColors();
  const opacity = useMemo(() => new Animated.Value(0.45), []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: radius,
          opacity,
          backgroundColor: colors.surfaceMuted,
        },
        style,
      ]}
    />
  );
}

/** Auth / profile placeholder used between route transitions. */
export function SkeletonCard({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
        padded && styles.cardPadded,
        style,
      ]}>
      {children}
    </View>
  );
}

export function AuthScreenSkeleton() {
  return (
    <View style={styles.screen} accessibilityLabel="Loading content">
      <Skeleton width={160} height={28} style={styles.center} />
      <Skeleton width="80%" height={14} style={styles.center} />
      <Skeleton width="70%" height={14} style={styles.center} />
      <View style={styles.card}>
        <Skeleton width={96} height={12} />
        <Skeleton width="90%" height={18} />
      </View>
      <Skeleton width="100%" height={54} radius={radii.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  screen: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  center: {
    alignSelf: 'center',
  },
  card: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardPadded: {
    padding: spacing.lg,
  },
});
