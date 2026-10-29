import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { StatusFilter, TaskCategory } from '@/features/checklist/types';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const STATUS_CHIPS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Completed' },
  { id: 'overdue', label: 'Overdue' },
];

export function TaskFilterBar({
  status,
  onStatusChange,
  categories,
  categoryId,
  onCategoryChange,
  query,
  onQueryChange,
}: {
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  categories: TaskCategory[];
  categoryId: string | null;
  onCategoryChange: (value: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search tasks…"
        placeholderTextColor={colors.textSubtle}
        style={styles.search}
        accessibilityLabel="Search tasks"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_CHIPS.map((chip) => {
          const selected = status === chip.id;
          return (
            <Pressable
              key={chip.id}
              onPress={() => onStatusChange(chip.id)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <AppText
                variant="caption"
                style={{ color: selected ? colors.onPrimary : colors.textMuted }}>
                {chip.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable
          onPress={() => onCategoryChange(null)}
          style={[styles.chip, !categoryId && styles.chipSelectedAlt]}
          accessibilityRole="button"
          accessibilityState={{ selected: !categoryId }}>
          <AppText
            variant="caption"
            style={{ color: !categoryId ? colors.success : colors.textMuted }}>
            All categories
          </AppText>
        </Pressable>
        {categories.map((category) => {
          const selected = categoryId === category.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => onCategoryChange(category.id)}
              style={[styles.chip, selected && styles.chipSelectedAlt]}
              accessibilityRole="button"
              accessibilityState={{ selected }}>
              <AppText
                variant="caption"
                style={{ color: selected ? colors.success : colors.textMuted }}>
                {category.name_en}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  search: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipSelectedAlt: {
    backgroundColor: colors.successMuted,
    borderColor: colors.success,
  },
});
