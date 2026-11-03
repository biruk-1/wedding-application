import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { weddingThemes } from '@/theme/palettes';
import { useColors } from '@/theme/WeddingThemeContext';
import type { AppColors, WeddingVisualStyle } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { weddingStyleLabel } from '@/theme/weddingStyle';

const OPTIONS: { id: WeddingVisualStyle; image: number }[] = [
  { id: 'modern', image: weddingThemes.modern.decorations.dashboardHeroImage },
  { id: 'traditional', image: weddingThemes.traditional.decorations.dashboardHeroImage },
  { id: 'blend', image: weddingThemes.blend.decorations.dashboardHeroImage },
];

export function WeddingStylePicker({
  value,
  onChange,
  disabled,
}: {
  value: WeddingVisualStyle;
  onChange: (style: WeddingVisualStyle) => void;
  disabled?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <Pressable
            key={option.id}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!disabled }}
            onPress={() => onChange(option.id)}
            style={[styles.card, selected && styles.cardSelected, disabled && styles.disabled]}>
            <Image source={option.image} style={styles.image} resizeMode="cover" />
            <AppText variant="caption" style={[styles.label, selected && styles.labelSelected]}>
              {weddingStyleLabel(option.id)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    card: {
      flex: 1,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    cardSelected: {
      borderColor: colors.primary,
    },
    disabled: {
      opacity: 0.6,
    },
    image: {
      width: '100%',
      height: 72,
    },
    label: {
      padding: spacing.sm,
      textAlign: 'center',
      color: colors.textMuted,
    },
    labelSelected: {
      color: colors.heading,
      fontWeight: '600',
    },
  });
}
