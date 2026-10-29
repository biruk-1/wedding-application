import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import type { TaskWithRelations } from '@/features/checklist/types';
import { isTaskOverdue, statusLabel } from '@/features/checklist/utils/taskHelpers';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function TaskRow({
  task,
  onPress,
  onToggleComplete,
  canWrite,
}: {
  task: TaskWithRelations;
  onPress: () => void;
  onToggleComplete: () => void;
  canWrite: boolean;
}) {
  const done = task.status === 'done';
  const overdue = isTaskOverdue(task);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={task.title}>
      <Pressable
        onPress={canWrite ? onToggleComplete : undefined}
        disabled={!canWrite}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !canWrite }}
        style={[styles.check, done && styles.checkDone]}>
        {done ? <Ionicons name="checkmark" size={16} color={colors.onSuccess} /> : null}
      </Pressable>
      <View style={styles.body}>
        <AppText
          variant="bodyMedium"
          style={[styles.title, done && styles.titleDone]}
          numberOfLines={2}>
          {task.title}
        </AppText>
        <View style={styles.meta}>
          {task.category ? (
            <AppText variant="caption" color="textMuted">
              {task.category.name_en}
            </AppText>
          ) : null}
          {task.due_date ? (
            <AppText variant="caption" color={overdue ? 'danger' : 'textMuted'}>
              {formatWeddingDateLabel(task.due_date)}
            </AppText>
          ) : null}
        </View>
        <View style={styles.badges}>
          <Badge label={statusLabel(task.status)} tone={done ? 'success' : overdue ? 'danger' : 'neutral'} />
          {task.priority === 'high' || task.priority === 'urgent' ? (
            <Badge label={task.priority} tone="warning" />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.9,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
  },
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
