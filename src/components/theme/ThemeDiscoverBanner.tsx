import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FusionStripe, TibebBand } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';
import type { AppColors, ThemeDecorations } from '@/theme/types';

export type ThemeDiscoverBannerProps = {
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  onPress?: () => void;
};

/**
 * Photography-led promotional strip for Vendors (and similar discovery surfaces).
 * Each theme gets its own image, overlay and ornament treatment.
 */
export function ThemeDiscoverBanner({
  title = 'Discover vendors',
  subtitle = 'Curated for your celebration style',
  ctaLabel = 'Explore',
  onPress,
}: ThemeDiscoverBannerProps) {
  const { colors, decorations } = useWeddingTheme();
  const styles = useMemo(() => createStyles(colors, decorations), [colors, decorations]);
  const env = decorations.environment;

  const content = (
    <View style={styles.wrap}>
      <Image
        source={decorations.discoverImage}
        style={styles.image}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={
          env === 'traditional'
            ? ['rgba(36,75,55,0.15)', 'rgba(36,75,55,0.72)']
            : env === 'fusion'
              ? ['rgba(46,42,39,0.12)', 'rgba(129,67,75,0.68)']
              : ['rgba(20,24,20,0.08)', 'rgba(20,24,20,0.62)']
        }
        style={StyleSheet.absoluteFill}
      />
      {env === 'traditional' ? (
        <View style={styles.band}>
          <TibebBand height={9} />
        </View>
      ) : null}
      {env === 'fusion' ? (
        <View style={styles.stripe}>
          <FusionStripe height={6} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <AppText variant="title" color="textOnDark" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="caption" color="textOnDark" style={styles.subtitle}>
          {subtitle}
        </AppText>
        <View style={styles.cta}>
          <AppText variant="label" color="textOnDark">
            {ctaLabel}
          </AppText>
        </View>
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${ctaLabel}`}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

function createStyles(colors: AppColors, decorations: ThemeDecorations) {
  const env = decorations.environment;
  return StyleSheet.create({
    wrap: {
      borderRadius: decorations.cardRadius + 2,
      overflow: 'hidden',
      minHeight: 148,
      backgroundColor: colors.heading,
      borderWidth: env === 'traditional' ? 1 : 0,
      borderColor: colors.primaryMuted,
    },
    image: {
      ...StyleSheet.absoluteFill,
      width: '100%',
      height: '100%',
    },
    band: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 1,
    },
    stripe: {
      position: 'absolute',
      top: spacing.sm,
      left: '28%',
      right: '28%',
      zIndex: 1,
    },
    copy: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: spacing.lg,
      gap: spacing.xs,
      minHeight: 148,
    },
    title: {
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    subtitle: {
      opacity: 0.92,
      marginBottom: spacing.sm,
    },
    cta: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: decorations.buttonRadius,
      backgroundColor:
        env === 'traditional'
          ? colors.success
          : env === 'fusion'
            ? colors.accent
            : 'rgba(255,255,255,0.22)',
      borderWidth: env === 'modern' ? StyleSheet.hairlineWidth : 0,
      borderColor: 'rgba(255,255,255,0.45)',
    },
    pressed: {
      opacity: 0.94,
    },
  });
}
