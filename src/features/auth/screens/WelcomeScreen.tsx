import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand/BrandMark';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { WELCOME_PORTRAIT } from '@/theme/palettes';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { typography } from '@/theme/typography';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

/**
 * Welcome composition from the approved Kiburan reference:
 * full-bleed photo, gold mark + brand wordmark, CTAs in the lower third.
 */
export function WelcomeScreen() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();

  return (
    <View
      style={[styles.root, { width, minHeight: height }]}
      accessibilityLabel="Kiburan welcome">
      <StatusBar style="light" />
      <Image
        source={WELCOME_PORTRAIT}
        style={[StyleSheet.absoluteFill, { width, height }]}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(20,24,20,0.62)', 'rgba(20,24,20,0.12)', 'rgba(20,24,20,0.82)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, spacing.xl) + spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.xl) + spacing.md,
            minHeight: height,
          },
        ]}>
        <View style={styles.brandBlock}>
          <BrandMark size={58} color={colors.primary} />
          <AppText
            variant="brand"
            color="textOnDark"
            accessibilityRole="header"
            style={styles.brand}>
            Kiburan
          </AppText>
          <AppText variant="subtitle" color="textOnDark" style={styles.tagline}>
            Plan Together{'\n'}Celebrate Forever
          </AppText>
        </View>

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <Button
            label="Get Started"
            accessibilityHint="Continue to create an account"
            onPress={() => router.push('/register')}
          />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="I already have an account"
            hitSlop={10}
            onPress={() => router.push('/login')}
            style={({ pressed }) => [styles.secondaryLink, pressed && styles.secondaryPressed]}>
            <AppText variant="bodyMedium" color="textOnDark" style={styles.secondaryText}>
              I already have an account
            </AppText>
          </Pressable>

        </View>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.success,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing['2xl'],
  },
  brand: {
    textAlign: 'center',
    marginTop: spacing.sm,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  tagline: {
    ...typography.subtitle,
    fontFamily: typography.body.fontFamily,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    opacity: 0.95,
  },
  spacer: {
    flexGrow: 1,
    minHeight: spacing['3xl'],
  },
  actions: {
    gap: spacing.lg,
    alignItems: 'stretch',
    paddingBottom: spacing.sm,
    width: '100%',
  },
  secondaryLink: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  secondaryText: {
    textAlign: 'center',
  },
  });
}
