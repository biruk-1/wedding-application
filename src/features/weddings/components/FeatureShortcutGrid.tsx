import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';

export type FeatureShortcut = {
  id: string;
  label: string;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'gold' | 'green';
  enabled?: boolean;
  onPress: () => void;
};

export function FeatureShortcutGrid({ items }: { items: FeatureShortcut[] }) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);
  const { width } = useWindowDimensions();
  const horizontalPad = spacing.xl * 2;
  const gap = spacing.md;
  const tileWidth = Math.floor((width - horizontalPad - gap * 2) / 3);

  return (
    <View style={[styles.grid, { gap }]}>
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${item.label}${item.sublabel ? `, ${item.sublabel}` : ''}`}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.tile,
            { width: tileWidth },
            pressed && styles.pressed,
          ]}>
          <View
            style={[
              styles.iconWrap,
              item.tone === 'green' ? styles.iconGreen : styles.iconGold,
            ]}>
            <Ionicons
              name={item.icon}
              size={22}
              color={item.tone === 'green' ? colors.success : colors.primary}
            />
          </View>
          <AppText variant="caption" color="heading" style={styles.label} numberOfLines={1}>
            {item.label}
          </AppText>
          {item.sublabel ? (
            <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.sublabel}>
              {item.sublabel}
            </AppText>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: AppColors, shadows: ReturnType<typeof useThemedShadows>) {
  return StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tile: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    ...shadows.soft,
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
    marginBottom: spacing.xs,
  },
  iconGold: {
    backgroundColor: colors.primaryMuted,
  },
  iconGreen: {
    backgroundColor: colors.successMuted,
  },
  label: {
    textAlign: 'center',
    fontWeight: '600',
  },
  sublabel: {
    textAlign: 'center',
    fontSize: 12,
  },
  });
}
