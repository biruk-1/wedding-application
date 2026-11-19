import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { TeamActivityItem } from '@/features/team/types';
import { formatActivityAction } from '@/features/team/utils/activityLabels';
import { spacing } from '@/theme/spacing';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ActivityRow({ item }: { item: TeamActivityItem }) {
  const who = item.actor_name?.trim() || 'Someone';
  return (
    <View style={styles.row} accessibilityLabel={`${who} ${formatActivityAction(item)}`}>
      <AppText variant="body">
        <AppText variant="bodyMedium">{who}</AppText> {formatActivityAction(item)}
      </AppText>
      <AppText variant="caption" color="textMuted">
        {formatWhen(item.created_at)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
