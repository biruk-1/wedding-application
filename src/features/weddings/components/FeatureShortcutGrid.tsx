import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors, ThemeDecorations } from '@/theme/types';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';

export type FeatureShortcut = {
  id: string;
  label: string;
  sublabel?: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Soft accent family for the icon tile — gold / green / wine. */
  tone?: 'gold' | 'green' | 'wine';
  enabled?: boolean;
  onPress: () => void;
};

type ShortcutAccent = { icon: string; bg: string };

/** Per-tile accents so the six menus feel lively while staying on-theme. */
function accentForShortcut(
  id: string,
  tone: FeatureShortcut['tone'],
  colors: AppColors,
  env: ThemeDecorations['environment'],
): ShortcutAccent {
  const gold = { icon: colors.primary, bg: colors.primaryMuted };
  const green = { icon: colors.success, bg: colors.successMuted };
  const wine = { icon: colors.accent, bg: colors.accentMuted };
  const heading = { icon: colors.heading, bg: colors.surfaceMuted };

  if (tone === 'gold') return gold;
  if (tone === 'green') return green;
  // Modern palette reuses green for accent — prefer champagne gold so tiles stay distinct.
  if (tone === 'wine') return env === 'modern' ? gold : wine;

  // Default pairing by menu id — screenshot-like gold/green rhythm.
  switch (id) {
    case 'checklist':
      return env === 'fusion' ? wine : green;
    case 'vendors':
      return gold;
    case 'guests':
      return env === 'modern' ? heading : green;
    case 'budget':
      return gold;
    case 'invites':
      return env === 'fusion' ? wine : gold;
    case 'timeline':
      return env === 'modern' ? green : heading;
    default:
      return env === 'traditional' ? green : gold;
  }
}

export function FeatureShortcutGrid({ items }: { items: FeatureShortcut[] }) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(
    () => createStyles(colors, decorations, shadows),
    [colors, decorations, shadows],
  );
  const { width } = useWindowDimensions();
  const horizontalPad = spacing.xl * 2;
  const gap = spacing.md;
  const tileWidth = Math.floor((width - horizontalPad - gap * 2) / 3);
  const env = decorations.environment;

  return (
    <View style={[styles.grid, { gap }]}>
      {items.map((item) => {
        const accent = accentForShortcut(item.id, item.tone, colors, env);
        return (
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
            <View style={[styles.iconWrap, { backgroundColor: accent.bg }]}>
              <Ionicons name={item.icon} size={24} color={accent.icon} />
            </View>
            <AppText variant="caption" color="heading" style={styles.label} numberOfLines={1}>
              {item.label}
            </AppText>
            {item.sublabel ? (
              <AppText
                variant="caption"
                color="textMuted"
                numberOfLines={1}
                style={styles.sublabel}>
                {item.sublabel}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(
  colors: AppColors,
  decorations: ThemeDecorations,
  shadows: ReturnType<typeof useThemedShadows>,
) {
  const env = decorations.environment;
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
      borderRadius: decorations.cardRadius,
      borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
      borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
      ...(env === 'traditional' ? shadows.soft : shadows.card),
    },
    pressed: {
      opacity: 0.92,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: env === 'traditional' ? radii.sm : radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
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
