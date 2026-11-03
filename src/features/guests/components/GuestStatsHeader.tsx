import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import type { GuestStats } from '@/features/guests/types';
import { spacing } from '@/theme/spacing';
import type { AppColors, ColorToken } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const CELLS: { key: keyof Pick<GuestStats, 'total' | 'yes' | 'maybe' | 'no' | 'pending'>; label: string; color: ColorToken }[] = [
  { key: 'total', label: 'Guests', color: 'text' },
  { key: 'yes', label: 'Attending', color: 'success' },
  { key: 'maybe', label: 'Maybe', color: 'warning' },
  { key: 'no', label: 'Declined', color: 'danger' },
  { key: 'pending', label: 'Pending', color: 'textMuted' },
];

export function GuestStatsHeader({
  stats,
  eventName,
}: {
  stats: GuestStats;
  /** Name of the event the counts refer to; null means strongest response across all events. */
  eventName: string | null;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {CELLS.map((cell) => (
          <View key={cell.key} style={styles.cell}>
            <AppText variant="subtitle" color={cell.color} style={styles.value}>
              {stats[cell.key]}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.label}>
              {cell.label}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <AppText variant="caption" color="textMuted">
          {eventName ? `RSVPs for ${eventName}` : 'Best response across events'}
          {stats.plusOnesAllowed > 0 ? ` - ${stats.plusOnesAllowed} with plus one allowed` : ''}
        </AppText>
      </View>
    </Card>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  label: {
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  });
}
