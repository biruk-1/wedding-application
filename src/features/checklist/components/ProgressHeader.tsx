import { StyleSheet, View } from 'react-native';

import { TibebBand } from '@/components/theme/ornaments';
import { AppText } from '@/components/ui/AppText';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { ChecklistProgress } from '@/features/checklist/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';
import { useColors, useDecorations } from '@/theme/WeddingThemeContext';

export function ProgressHeader({
  progress,
  label = 'Wedding progress',
  variant = 'bar',
}: {
  progress: ChecklistProgress;
  label?: string;
  /** `ring` matches the Tasks screen in the design reference. */
  variant?: 'bar' | 'ring';
}) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const env = useDecorations().environment;
  const fillColor =
    env === 'traditional' ? colors.success : env === 'fusion' ? colors.accent : colors.primary;

  if (variant === 'ring') {
    return (
      <View style={styles.ringWrap} accessibilityLabel={`${label} ${progress.percent}% complete`}>
        <ProgressRing percent={progress.percent} label="Overall" />
        <View style={styles.ringCopy}>
          <AppText variant="label">{label}</AppText>
          <AppText variant="caption" color="textMuted">
            {progress.completed} of {progress.total} completed
            {progress.overdue > 0 ? ` · ${progress.overdue} overdue` : ''}
            {progress.upcoming > 0 ? ` · ${progress.upcoming} upcoming` : ''}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel={`${label} ${progress.percent}% complete`}>
      <View style={styles.row}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="label" style={{ color: fillColor }}>
          {progress.percent}%
        </AppText>
      </View>
      <View style={[styles.track, env === 'traditional' && styles.trackTraditional]}>
        <View
          style={[
            styles.fill,
            env === 'traditional' && styles.fillTraditional,
            { width: `${progress.percent}%`, backgroundColor: fillColor },
          ]}>
          {env === 'traditional' ? <TibebBand height={10} /> : null}
        </View>
      </View>
      <AppText variant="caption" color="textMuted">
        {progress.completed} of {progress.total} completed
        {progress.overdue > 0 ? ` · ${progress.overdue} overdue` : ''}
        {progress.upcoming > 0 ? ` · ${progress.upcoming} upcoming` : ''}
      </AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    ringWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginBottom: spacing.lg,
      paddingVertical: spacing.sm,
    },
    ringCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    track: {
      height: 6,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
    },
    trackTraditional: {
      height: 8,
      borderRadius: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primaryMuted,
    },
    fill: {
      height: '100%',
      borderRadius: radii.pill,
    },
    fillTraditional: {
      borderRadius: 0,
      overflow: 'hidden',
    },
  });
}
