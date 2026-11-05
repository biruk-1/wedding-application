import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { categoryIcon, categoryTone } from '@/features/checklist/utils/categoryIcons';
import type { CategoryProgressRow } from '@/features/checklist/utils/categoryProgress';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';
import type { AppColors, ThemeDecorations } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function CategoryCard({
  row,
  index,
  onPress,
}: {
  row: CategoryProgressRow;
  index: number;
  onPress: (categoryId: string) => void;
}) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createStyles(colors, decorations, shadows.soft),
    [colors, decorations, shadows.soft],
  );
  const tone = categoryTone(index, colors);
  const icon = categoryIcon(row.icon ?? row.slug);
  const env = decorations.environment;
  const chevron = env === 'traditional' ? colors.success : env === 'fusion' ? colors.accent : colors.primary;

  return (
    <Pressable
      onPress={() => onPress(row.id)}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.completed} of ${row.total} completed`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {env === 'fusion' ? <View style={styles.fusionTab} /> : null}
      <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
        <Ionicons name={icon} size={22} color={tone.fg} />
      </View>
      <View style={styles.body}>
        <AppText variant="bodyMedium" color="heading" numberOfLines={1}>
          {row.name}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {row.completed}/{row.total} completed
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={chevron} />
    </Pressable>
  );
}

function createStyles(colors: AppColors, decorations: ThemeDecorations, softShadow: object) {
  const env = decorations.environment;
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surfaceElevated,
      borderRadius: decorations.cardRadius + 2,
      borderWidth: env === 'traditional' ? 1 : 0,
      borderColor: colors.primaryMuted,
      ...(softShadow as object),
    },
    pressed: {
      opacity: 0.92,
    },
    fusionTab: {
      position: 'absolute',
      top: 0,
      left: spacing.lg,
      width: 22,
      height: 3,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      backgroundColor: colors.primary,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: env === 'traditional' ? radii.sm : radii.md,
      borderWidth: env === 'traditional' ? 1 : 0,
      borderColor: colors.primaryMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: spacing.xxs,
    },
  });
}
