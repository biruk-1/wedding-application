import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { getCountdownParts } from '@/features/weddings/utils/countdown';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function CountdownStrip({ weddingDate }: { weddingDate: string }) {
  const parts = getCountdownParts(weddingDate);
  if (!parts) return null;

  const cells = [
    { label: 'Days', value: parts.days },
    { label: 'Hours', value: parts.hours },
    { label: 'Minutes', value: parts.minutes },
  ];

  return (
    <View style={styles.wrap} accessibilityLabel="Wedding countdown">
      <AppText variant="caption" color="textMuted" style={styles.caption}>
        {parts.isPast ? 'Since your wedding day' : 'Countdown'}
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

const styles = StyleSheet.create({
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
