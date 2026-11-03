import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/features/guests/components/Chip';
import type { GuestGroup } from '@/features/guests/types';
import { spacing } from '@/theme/spacing';

/**
 * Group picker. `scroll` renders a single horizontal row (filter bars); otherwise chips wrap
 * (forms). `allLabel` adds a leading "no selection" chip that emits `null`.
 */
export function GroupChipList({
  groups,
  selectedId,
  onSelect,
  allLabel,
  scroll = false,
  tone = 'success',
  disabled,
}: {
  groups: GuestGroup[];
  selectedId: string | null;
  onSelect: (groupId: string | null) => void;
  allLabel?: string;
  scroll?: boolean;
  tone?: 'primary' | 'success';
  disabled?: boolean;
}) {
  const chips = (
    <>
      {allLabel ? (
        <Chip
          label={allLabel}
          selected={selectedId === null}
          onPress={() => onSelect(null)}
          tone={tone}
          disabled={disabled}
        />
      ) : null}
      {groups.map((group) => (
        <Chip
          key={group.id}
          label={group.name}
          selected={selectedId === group.id}
          onPress={() => onSelect(group.id)}
          tone={tone}
          disabled={disabled}
        />
      ))}
    </>
  );

  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.wrap}>{chips}</View>;
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
