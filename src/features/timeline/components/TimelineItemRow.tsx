import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import type { TimelineItemWithAssignee } from '@/features/timeline/types';
import { formatTimeRange } from '@/features/timeline/utils/datetime';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

function TimelineItemRowComponent({
  item,
  timeZone,
  onOpen,
  onMoveUp,
  onMoveDown,
  canReorder,
}: {
  item: TimelineItemWithAssignee;
  timeZone: string;
  onOpen: (itemId: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canReorder?: boolean;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Card style={styles.card}>
      <Pressable onPress={() => onOpen(item.id)} accessibilityRole="button">
        <AppText variant="subtitle" style={styles.title}>
          {item.title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {formatTimeRange(item.starts_at, item.ends_at, timeZone)}
        </AppText>
        {item.assignee ? (
          <AppText variant="caption" color="textSubtle">
            Assigned to {item.assignee.display_name}
          </AppText>
        ) : null}
        {item.notes ? (
          <AppText variant="caption" color="textMuted" numberOfLines={2}>
            {item.notes}
          </AppText>
        ) : null}
      </Pressable>
      {canReorder ? (
        <View style={styles.reorder}>
          <Pressable onPress={onMoveUp} accessibilityRole="button" style={styles.reorderBtn}>
            <AppText variant="caption" color="primary">
              Up
            </AppText>
          </Pressable>
          <Pressable onPress={onMoveDown} accessibilityRole="button" style={styles.reorderBtn}>
            <AppText variant="caption" color="primary">
              Down
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

export const TimelineItemRow = memo(TimelineItemRowComponent);

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
  },
  reorder: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reorderBtn: {
    paddingVertical: spacing.xs,
  },
  });
}
