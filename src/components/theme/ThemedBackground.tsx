import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FusionStripe, ModernArcs, TibebBand, useOrnamentTheme } from '@/components/theme/ornaments';
import type { WeddingTheme } from '@/theme/types';

export type ThemedBackgroundProps = {
  /** Render a specific theme (previews); defaults to the active wedding theme. */
  theme?: WeddingTheme;
  /** Scaled-down ornaments for preview cards; ignores safe-area insets. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Full-screen environment for the active wedding style. Ornaments stay in the top/bottom edges
 * and side gutters so they never sit behind body text.
 */
export function ThemedBackground({ theme, compact = false, style }: ThemedBackgroundProps) {
  const t = useOrnamentTheme(theme);
  const { colors, decorations } = t;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(1));
  const previousId = useRef(t.id);

  useEffect(() => {
    if (previousId.current === t.id) return;
    previousId.current = t.id;
    if (reduceMotion || compact) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [t.id, fade, reduceMotion, compact]);

  const top = compact ? 0 : insets.top;
  const env = decorations.environment;

  // Midpoint between strong atmosphere and content clarity (~80–85% of the stronger wash).
  const atmosphereFade =
    env === 'traditional'
      ? ([`${colors.surface}10`, `${colors.surface}66`, `${colors.surface}EE`] as const)
      : env === 'fusion'
        ? ([`${colors.surface}0A`, `${colors.accentMuted}58`, `${colors.surface}EC`] as const)
        : ([`${colors.surface}0A`, `${colors.surface}60`, `${colors.surface}EE`] as const);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip, { opacity: fade, backgroundColor: colors.surface }, style]}>
      <LinearGradient
        colors={[...decorations.backgroundGradient]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={decorations.texture}
        resizeMode="repeat"
        style={[styles.texture, { opacity: decorations.textureOpacity }]}
      />
      {/* Photo wash sits above the weave so cultural imagery stays visible (reference-like). */}
      <View style={[styles.atmosphere, compact && styles.atmosphereCompact]}>
        <Image
          source={decorations.atmosphereImage}
          resizeMode="cover"
          style={[
            styles.atmosphereImage,
            { opacity: compact ? decorations.atmosphereOpacity * 0.85 : decorations.atmosphereOpacity },
          ]}
        />
        <LinearGradient colors={[...atmosphereFade]} locations={[0.12, 0.58, 1]} style={StyleSheet.absoluteFill} />
      </View>

      {env === 'modern' ? (
        <>
          <ModernArcs theme={t} size={compact ? 150 : 300} />
          <ModernArcs theme={t} corner="bottomLeft" size={compact ? 110 : 240} />
        </>
      ) : null}

      {env === 'traditional' ? (
        <>
          <View style={[styles.edge, { top }]}>
            <TibebBand theme={t} height={compact ? 7 : 12} />
            <View style={[styles.hairline, { backgroundColor: colors.primary, marginTop: compact ? 2 : 3 }]} />
          </View>
          <View style={[styles.edge, styles.bottomEdge]}>
            <View style={[styles.hairline, { backgroundColor: colors.primary, marginBottom: compact ? 2 : 3 }]} />
            <TibebBand theme={t} height={compact ? 5 : 9} />
          </View>
          <View
            style={[
              styles.sideRule,
              { left: compact ? 4 : 8, top: top + (compact ? 14 : 24), backgroundColor: colors.primaryMuted },
            ]}
          />
          <View
            style={[
              styles.sideRule,
              { right: compact ? 4 : 8, top: top + (compact ? 14 : 24), backgroundColor: colors.primaryMuted },
            ]}
          />
        </>
      ) : null}

      {env === 'fusion' ? (
        <>
          <View
            style={[
              styles.frame,
              {
                top: top + (compact ? 5 : 8),
                left: compact ? 5 : 10,
                right: compact ? 5 : 10,
                bottom: compact ? 5 : 10,
                borderRadius: compact ? 10 : 22,
                borderColor: colors.primary,
              },
            ]}
          />
          <View style={[styles.fusionStripe, { top: top + (compact ? 2 : 4) }]}>
            <FusionStripe theme={t} height={compact ? 6 : 9} />
          </View>
          <LinearGradient
            colors={[colors.accentMuted, 'rgba(255,255,255,0)']}
            start={{ x: 1, y: 1 }}
            end={{ x: 0.4, y: 0.6 }}
            style={styles.wineGlow}
          />
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  atmosphere: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '54%',
  },
  atmosphereCompact: {
    height: '66%',
  },
  atmosphereImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  texture: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bottomEdge: {
    bottom: 0,
  },
  hairline: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.6,
  },
  sideRule: {
    position: 'absolute',
    bottom: 24,
    width: StyleSheet.hairlineWidth * 2,
    opacity: 0.7,
  },
  frame: {
    position: 'absolute',
    borderWidth: 1,
    opacity: 0.4,
  },
  fusionStripe: {
    position: 'absolute',
    alignSelf: 'center',
    left: '30%',
    right: '30%',
  },
  wineGlow: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '70%',
    height: '45%',
    opacity: 0.8,
  },
});
