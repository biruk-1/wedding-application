import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { categoryIcon, categoryTone } from '@/features/checklist/utils/categoryIcons';
import type { CategoryProgressRow } from '@/features/checklist/utils/categoryProgress';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';
import type { AppColors } from '@/theme/types';
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
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useMemo(() => createStyles(colors, shadows.soft), [colors, shadows.soft]);
  const tone = categoryTone(index, colors);
  const icon = categoryIcon(row.icon ?? row.slug);

  return (
    <Pressable
      onPress={() => onPress(row.id)}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.completed} of ${row.total} completed`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
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
      <Ionicons name="chevron-forward" size={20} color={colors.primary} />
    </Pressable>
  );
}

function createStyles(colors: AppColors, softShadow: object) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radii.xl,
      ...(softShadow as object),
    },
    pressed: {
      opacity: 0.92,
    },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: spacing.xxs,
    },
  });
}
