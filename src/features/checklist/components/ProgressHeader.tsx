import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { ChecklistProgress } from '@/features/checklist/types';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function ProgressHeader({ progress }: { progress: ChecklistProgress }) {
  return (
    <View style={styles.wrap} accessibilityLabel={`Checklist ${progress.percent}% complete`}>
      <View style={styles.row}>
        <AppText variant="label">Wedding progress</AppText>
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

const styles = StyleSheet.create({
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
