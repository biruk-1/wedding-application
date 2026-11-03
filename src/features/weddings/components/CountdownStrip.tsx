import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { getCelebrationCopy } from '@/features/weddings/celebrationCopy';
import { getCountdownParts } from '@/features/weddings/utils/countdown';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function CountdownStrip({
  weddingDate,
  celebrationKind = 'wedding',
}: {
  weddingDate: string;
  celebrationKind?: string | null;
}) {
  const styles = useThemedStyles(createStyles);
  const copy = getCelebrationCopy(celebrationKind);
  const parts = getCountdownParts(weddingDate);
  if (!parts) return null;

  const cells = [
    { label: 'Days', value: parts.days },
    { label: 'Hours', value: parts.hours },
    { label: 'Minutes', value: parts.minutes },
  ];

  return (
    <View style={styles.wrap} accessibilityLabel={copy.countdownAccessibilityLabel}>
      <AppText variant="caption" color="textMuted" style={styles.caption}>
        {parts.isPast ? copy.pastDateLabel : 'Countdown'}
      </AppText>
      <View style={styles.row}>
        {cells.map((cell) => (
          <View key={cell.label} style={styles.cell}>
            <AppText variant="title" style={styles.value}>
              {cell.value}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {cell.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  caption: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.success,
  },
  value: {
    color: colors.onSuccess,
  },
  });
}
