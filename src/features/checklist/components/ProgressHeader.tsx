import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { ChecklistProgress } from '@/features/checklist/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function ProgressHeader({
  progress,
  label = 'Wedding progress',
}: {
  progress: ChecklistProgress;
  label?: string;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap} accessibilityLabel={`${label} ${progress.percent}% complete`}>
      <View style={styles.row}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="label" color="success">
          {progress.percent}%
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress.percent}%` }]} />
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: radii.pill,
  },
  });
}
