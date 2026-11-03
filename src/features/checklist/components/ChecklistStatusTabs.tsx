import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export type ChecklistTab = 'all' | 'todo' | 'done';

export function ChecklistStatusTabs({
  value,
  counts,
  onChange,
}: {
  value: ChecklistTab;
  counts: { all: number; todo: number; done: number };
  onChange: (value: ChecklistTab) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const tabs: { id: ChecklistTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'todo', label: 'To Do', count: counts.todo },
    { id: 'done', label: 'Completed', count: counts.done },
  ];

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const selected = value === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, selected && styles.tabActive]}>
            <AppText
              variant="caption"
              style={[styles.label, selected && styles.labelActive]}
              numberOfLines={1}>
              {tab.label} ({tab.count})
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  label: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.onPrimary,
  },
  });
}
