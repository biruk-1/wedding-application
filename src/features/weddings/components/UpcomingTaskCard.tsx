import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { TaskWithRelations } from '@/features/checklist/types';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { radii } from '@/theme/radii';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedShadows, useThemedStyles } from '@/theme/useThemedStyles';
import { spacing } from '@/theme/spacing';

export function UpcomingTaskCard({
  task,
  canWrite,
  onOpen,
  onToggleComplete,
}: {
  task: TaskWithRelations;
  canWrite: boolean;
  onOpen: (taskId: string) => void;
  onToggleComplete: (taskId: string, currentlyDone: boolean) => void;
}) {
  const colors = useColors();
  const shadows = useThemedShadows();
  const styles = useThemedStyles((themeColors) => createStyles(themeColors, shadows), [shadows]);
  const done = task.status === 'done';
  const high = task.priority === 'high' || task.priority === 'urgent';
  const due = formatWeddingDateLabel(task.due_date);

  return (
    <Pressable
      onPress={() => onOpen(task.id)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={task.title}>
      <Pressable
        onPress={canWrite ? () => onToggleComplete(task.id, done) : undefined}
        disabled={!canWrite}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !canWrite }}
        style={[styles.check, done && styles.checkDone]}>
        {done ? <Ionicons name="checkmark" size={16} color={colors.onSuccess} /> : null}
      </Pressable>
      <View style={styles.body}>
        <AppText variant="bodyMedium" numberOfLines={2} style={done && styles.titleDone}>
          {task.title}
        </AppText>
        <View style={styles.meta}>
          {high ? (
            <AppText variant="caption" color="danger" style={styles.priority}>
              High priority
            </AppText>
          ) : task.category ? (
            <AppText variant="caption" color="textMuted">
              {task.category.name_en}
            </AppText>
          ) : null}
          {due ? (
            <AppText variant="caption" color="primary">
              {due}
            </AppText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(colors: AppColors, shadows: ReturnType<typeof useThemedShadows>) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.xl,
    ...shadows.soft,
  },
  pressed: {
    opacity: 0.92,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.info,
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
  titleDone: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  priority: {
    fontWeight: '600',
  },
  });
}
