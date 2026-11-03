import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SearchField } from '@/components/ui/SearchField';
import { Chip } from '@/features/guests/components/Chip';
import { GroupChipList } from '@/features/guests/components/GroupChipList';
import type { GuestGroup, GuestRsvpFilter, GuestStats, WeddingEvent } from '@/features/guests/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const PRIMARY_TABS: { id: GuestRsvpFilter; label: string; countKey: keyof GuestStats }[] = [
  { id: 'all', label: 'All', countKey: 'total' },
  { id: 'pending', label: 'Invited', countKey: 'pending' },
  { id: 'yes', label: 'Confirmed', countKey: 'yes' },
];

const SECONDARY_TABS: { id: GuestRsvpFilter; label: string }[] = [
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: 'Declined' },
];

export function GuestFilterBar({
  query,
  onQueryChange,
  groups,
  groupId,
  onGroupChange,
  rsvp,
  onRsvpChange,
  events,
  eventId,
  onEventChange,
  stats,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  groups: GuestGroup[];
  groupId: string | null;
  onGroupChange: (value: string | null) => void;
  rsvp: GuestRsvpFilter;
  onRsvpChange: (value: GuestRsvpFilter) => void;
  events: WeddingEvent[];
  eventId: string | null;
  onEventChange: (value: string | null) => void;
  stats: GuestStats;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.wrap}>
      <View style={styles.primaryTabs}>
        {PRIMARY_TABS.map((tab) => {
          const selected = rsvp === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onRsvpChange(tab.id)}
              style={({ pressed }) => [
                styles.tab,
                selected && styles.tabSelected,
                pressed && !selected && styles.tabPressed,
              ]}>
              <AppText
                variant="caption"
                style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
                {tab.label} ({stats[tab.countKey]})
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SearchField
        value={query}
        onChangeText={onQueryChange}
        placeholder="Search guests..."
        accessibilityLabel="Search guests"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SECONDARY_TABS.map((tab) => (
          <Chip
            key={tab.id}
            label={tab.label}
            selected={rsvp === tab.id}
            onPress={() => onRsvpChange(tab.id)}
          />
        ))}
      </ScrollView>

      {events.length > 0 ? (
        <View style={styles.block}>
          <AppText variant="caption" color="textMuted">
            RSVP for
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip
              label="Any event"
              selected={eventId === null}
              onPress={() => onEventChange(null)}
              tone="success"
            />
            {events.map((event) => (
              <Chip
                key={event.id}
                label={event.name}
                selected={eventId === event.id}
                onPress={() => onEventChange(event.id)}
                tone="success"
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {groups.length > 0 ? (
        <GroupChipList
          groups={groups}
          selectedId={groupId}
          onSelect={onGroupChange}
          allLabel="All groups"
          scroll
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  primaryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  tabSelected: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  tabPressed: {
    backgroundColor: colors.border,
  },
  tabLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  tabLabelSelected: {
    color: colors.heading,
  },
  block: {
    gap: spacing.xs,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  });
}
