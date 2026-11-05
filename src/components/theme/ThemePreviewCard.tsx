import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { FusionStripe, HeaderOrnament, TibebBand } from '@/components/theme/ornaments';
import { ThemedBackground } from '@/components/theme/ThemedBackground';
import { AppText } from '@/components/ui/AppText';
import { getWeddingTheme } from '@/theme/palettes';
import { spacing } from '@/theme/spacing';
import type { WeddingTheme, WeddingVisualStyle } from '@/theme/types';
import { fontFamilies } from '@/theme/typography';
import { useColors } from '@/theme/WeddingThemeContext';

export const THEME_DESCRIPTIONS: Record<WeddingVisualStyle, string> = {
  modern: 'Ivory and champagne gold with soft gradients and clean lines.',
  traditional: 'Woven shamma texture with tibeb borders in green, gold and burgundy.',
  blend: 'Cream surfaces, antique gold framing and a single tibeb accent in wine.',
};

/** A miniature of the real screen environment: background, ornaments, card, button and tab strip. */
function MiniEnvironment({ theme, compact }: { theme: WeddingTheme; compact: boolean }) {
  const { colors, decorations } = theme;
  const env = decorations.environment;
  const cardRadius = Math.round(decorations.cardRadius * 0.6);

  return (
    <View style={[styles.mini, { height: compact ? 132 : 188, backgroundColor: colors.surface }]}>
      <ThemedBackground theme={theme} compact />
      <View style={[styles.miniBody, compact && styles.miniBodyCompact]}>
        <View style={styles.miniHeader}>
          <View style={[styles.miniTitle, { backgroundColor: colors.heading }]} />
          <HeaderOrnament theme={theme} />
        </View>
        <Image
          source={decorations.previewImage}
          style={[styles.miniHero, { height: compact ? 40 : 70, borderRadius: cardRadius }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View
          style={[
            styles.miniCard,
            {
              backgroundColor: colors.surfaceElevated,
              borderRadius: cardRadius,
              borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
              borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
            },
          ]}>
          {env === 'fusion' ? <View style={[styles.miniTab, { backgroundColor: colors.accent }]} /> : null}
          <View style={[styles.miniLine, { width: '60%', backgroundColor: colors.surfaceMuted }]} />
          {!compact ? (
            <View
              style={[
                styles.miniButton,
                { backgroundColor: colors.primary, borderRadius: Math.min(decorations.buttonRadius, 10) },
              ]}
            />
          ) : null}
        </View>
      </View>
      <View style={[styles.miniTabBar, { backgroundColor: colors.surfaceElevated, borderTopColor: colors.border }]}>
        {env === 'traditional' ? <TibebBand theme={theme} height={5} style={styles.miniTabBand} /> : null}
        {env === 'fusion' ? <FusionStripe theme={theme} height={4} style={styles.miniTabBand} /> : null}
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.miniTabDot,
              {
                backgroundColor:
                  index === 0
                    ? env === 'traditional'
                      ? colors.success
                      : env === 'fusion'
                        ? colors.accent
                        : colors.primary
                    : colors.borderStrong,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export function ThemePreviewCard({
  styleId,
  selected,
  onPress,
  disabled,
  compact = false,
}: {
  styleId: WeddingVisualStyle;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const active = useColors();
  const theme = getWeddingTheme(styleId);
  const label = compact ? theme.label.replace(' Ethiopian', '').replace('Ethiopian ', '') : theme.label;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      aria-checked={selected}
      accessibilityLabel={`${theme.label}. ${THEME_DESCRIPTIONS[styleId]}`}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        {
          borderColor: selected ? active.primary : active.border,
          backgroundColor: active.surfaceElevated,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <MiniEnvironment theme={theme} compact={compact} />
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <View style={styles.footerText}>
          <AppText
            variant={compact ? 'caption' : 'bodyMedium'}
            style={[
              { color: selected ? active.heading : active.text },
              selected && styles.selectedLabel,
              compact && styles.centered,
            ]}>
            {label}
          </AppText>
          {!compact ? (
            <AppText variant="caption" color="textMuted">
              {THEME_DESCRIPTIONS[styleId]}
            </AppText>
          ) : null}
        </View>
        {selected && !compact ? (
          <Ionicons name="checkmark-circle" size={22} color={active.primary} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 18,
    overflow: 'hidden',
  },
  cardCompact: {
    flex: 1,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
  mini: {
    overflow: 'hidden',
  },
  miniBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    gap: 7,
  },
  miniBodyCompact: {
    paddingHorizontal: 9,
    paddingTop: 11,
    gap: 5,
  },
  miniHeader: {
    alignItems: 'center',
    gap: 3,
  },
  miniTitle: {
    width: '46%',
    height: 5,
    borderRadius: 3,
    opacity: 0.85,
  },
  miniHero: {
    width: '100%',
  },
  miniCard: {
    padding: 7,
    gap: 6,
    overflow: 'hidden',
  },
  miniTab: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 14,
    height: 2,
  },
  miniLine: {
    height: 4,
    borderRadius: 2,
  },
  miniButton: {
    height: 10,
    width: '100%',
  },
  miniTabBar: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  miniTabBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  miniTabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footerCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  footerText: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontFamily: fontFamilies.bodyMedium,
  },
  centered: {
    textAlign: 'center',
  },
});
