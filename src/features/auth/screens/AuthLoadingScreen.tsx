import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand/BrandMark';
import { ThemedBackground } from '@/components/theme/ThemedBackground';
import { AppText } from '@/components/ui/AppText';
import { Skeleton } from '@/components/ui/Skeleton';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

/**
 * Shown while fonts/session restore finish — avoids route flicker before auth gate runs.
 */
export function AuthLoadingScreen({
  label = 'Restoring session…',
}: {
  label?: string;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={label}>
      <ThemedBackground />
      <BrandMark size={48} color={colors.primary} />
      <AppText variant="title" style={styles.brand}>
        Kiburan
      </AppText>
      <AppText variant="caption" color="textMuted" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.bars}>
        <Skeleton width={180} height={12} />
        <Skeleton width={140} height={12} />
        <Skeleton width="100%" height={48} radius={radii.pill} />
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  brand: {
    color: colors.text,
  },
  label: {
    marginBottom: spacing.sm,
  },
  bars: {
    width: '72%',
    maxWidth: 280,
    gap: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  });
}
