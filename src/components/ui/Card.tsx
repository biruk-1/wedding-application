import { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { FusionStripe, TibebBand } from '@/components/theme/ornaments';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { useThemedShadows } from '@/theme/useThemedStyles';
import { spacing } from '@/theme/spacing';
import type { AppColors, ThemeDecorations } from '@/theme/types';

export type CardProps = ViewProps & {
  padded?: boolean;
  elevated?: boolean;
  /** Featured card: adds the theme's band along the top edge (Traditional / Fusion). */
  ornament?: boolean;
};

function createCardStyles(colors: AppColors, decorations: ThemeDecorations) {
  const env = decorations.environment;
  return StyleSheet.create({
    base: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: decorations.cardRadius,
      borderWidth: env === 'traditional' ? 1 : StyleSheet.hairlineWidth,
      borderColor: env === 'traditional' ? colors.primaryMuted : colors.border,
    },
    clip: {
      overflow: 'hidden',
    },
    padded: {
      padding: spacing.lg,
    },
    fusionTab: {
      position: 'absolute',
      top: 0,
      left: spacing.lg,
      flexDirection: 'row',
      gap: 3,
    },
    fusionTabGold: {
      width: 22,
      height: 3,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      backgroundColor: colors.primary,
    },
    fusionTabWine: {
      width: 8,
      height: 3,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      backgroundColor: colors.accent,
    },
    band: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
    },
    bandSpacer: {
      height: spacing.sm,
    },
  });
}

export function Card({
  padded = true,
  elevated = true,
  ornament = false,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, decorations } = useWeddingTheme();
  const shadows = useThemedShadows();
  const styles = useMemo(() => createCardStyles(colors, decorations), [colors, decorations]);
  const env = decorations.environment;
  const showBand = ornament && env !== 'modern';

  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        elevated && (env === 'traditional' ? shadows.soft : shadows.card),
        showBand && styles.clip,
        style,
      ]}
      {...rest}>
      {showBand ? (
        <>
          <View style={styles.band}>
            {env === 'traditional' ? <TibebBand height={8} /> : <FusionStripe height={6} />}
          </View>
          <View style={styles.bandSpacer} />
        </>
      ) : null}
      {env === 'fusion' && !showBand ? (
        <View style={styles.fusionTab} pointerEvents="none">
          <View style={styles.fusionTabGold} />
          <View style={styles.fusionTabWine} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
