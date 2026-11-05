import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon } from 'react-native-svg';

import { OrnamentDivider } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import { useWeddingTheme } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

const MEDALLION = 76;

function Medallion({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { colors, decorations } = useWeddingTheme();
  const env = decorations.environment;
  const c = MEDALLION / 2;

  return (
    <View style={styles.medallion} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={MEDALLION} height={MEDALLION} style={StyleSheet.absoluteFill}>
        {env === 'traditional' ? (
          <>
            <Polygon
              points={`${c},2 ${MEDALLION - 2},${c} ${c},${MEDALLION - 2} 2,${c}`}
              fill={colors.successMuted}
              stroke={colors.primary}
              strokeWidth={1.5}
            />
            <Polygon
              points={`${c},10 ${MEDALLION - 10},${c} ${c},${MEDALLION - 10} 10,${c}`}
              fill="none"
              stroke={colors.success}
              strokeWidth={0.8}
            />
            <Polygon points={`${c},0 ${c + 3},3 ${c},6 ${c - 3},3`} fill={colors.accent} />
            <Polygon
              points={`${c},${MEDALLION - 6} ${c + 3},${MEDALLION - 3} ${c},${MEDALLION} ${c - 3},${MEDALLION - 3}`}
              fill={colors.accent}
            />
          </>
        ) : env === 'fusion' ? (
          <>
            <Circle cx={c} cy={c} r={c - 1} fill={colors.surfaceElevated} stroke={colors.primary} strokeWidth={1} />
            <Circle cx={c} cy={c} r={c - 7} fill={colors.accentMuted} />
            <Polygon points={`${c},1 ${c + 4},5 ${c},9 ${c - 4},5`} fill={colors.accent} />
          </>
        ) : (
          <>
            <Circle cx={c} cy={c} r={c - 1} fill="none" stroke={colors.primaryMuted} strokeWidth={1} />
            <Circle cx={c} cy={c} r={c - 8} fill={colors.surfaceElevated} stroke={colors.border} strokeWidth={1} />
          </>
        )}
      </Svg>
      <Ionicons
        name={icon}
        size={26}
        color={env === 'traditional' ? colors.success : env === 'fusion' ? colors.accent : colors.primary}
      />
    </View>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'sparkles-outline',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.wrap}>
      <Medallion icon={icon} />
      <AppText variant="subtitle" color="heading" style={styles.title}>
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" color="textMuted" style={styles.description}>
          {description}
        </AppText>
      ) : null}
      <OrnamentDivider style={styles.divider} />
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
    alignItems: 'stretch',
  },
  medallion: {
    width: MEDALLION,
    height: MEDALLION,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  divider: {
    width: '60%',
    alignSelf: 'center',
    marginVertical: spacing.xs,
  },
});
