import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { TimelineSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { CalendarMonth } from '@/features/timeline/components/CalendarMonth';
import { EventRow } from '@/features/timeline/components/EventRow';
import { useWeddingEvents } from '@/features/timeline/queries';
import type { EventFilter } from '@/features/timeline/types';
import {
  DEFAULT_WEDDING_TIMEZONE,
  addMonths,
  formatEventWhen,
  todayDateKey,
} from '@/features/timeline/utils/datetime';
import {
  buildCalendarDays,
  defaultMonthKey,
  eventDateKeys,
  eventsOnDate,
  filterEvents,
  nextUpcomingEvent,
} from '@/features/timeline/utils/timelineHelpers';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type ViewMode = 'list' | 'calendar';

export function TimelineDashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/more`);
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const eventsQuery = useWeddingEvents(weddingId);

  const timeZone = wedding.data?.timezone ?? DEFAULT_WEDDING_TIMEZONE;
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<EventFilter>('upcoming');
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const resolvedMonth = monthKey ?? defaultMonthKey(events, timeZone);
  const dateKeys = useMemo(() => eventDateKeys(events, timeZone), [events, timeZone]);
  const calendarDays = useMemo(
    () => buildCalendarDays(resolvedMonth, dateKeys, timeZone),
    [resolvedMonth, dateKeys, timeZone],
  );
  const listEvents = useMemo(
    () => filterEvents(events, filter, timeZone),
    [events, filter, timeZone],
  );
  const next = useMemo(() => nextUpcomingEvent(events), [events]);
  const selectedEvents = selectedDateKey
    ? eventsOnDate(events, selectedDateKey, timeZone)
    : [];

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <Header title="Timeline" subtitle={wedding.data?.title} showBack onBack={goBack} />
  );

  if (eventsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <TimelineSkeleton />
      </Screen>
    );
  }

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(eventsQuery.error)}
          </AppText>
          <Button label="Retry" onPress={() => void eventsQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen scroll contentStyle={{ paddingBottom: tabInset }}>
        <StatusBar style="dark" />
        {header}
        <RefreshNotice
          error={eventsQuery.isRefetchError ? eventsQuery.error : null}
          onRetry={() => void eventsQuery.refetch()}
        />

        <View style={styles.stack}>
        {next ? (
          <Card style={styles.nextCard}>
            <AppText variant="caption" color="textMuted">
              Next up
            </AppText>
            <AppText variant="subtitle">{next.name}</AppText>
            <AppText variant="caption" color="textMuted">
              {formatEventWhen(next.starts_at, next.ends_at, timeZone)}
            </AppText>
            <Button
              label="Open event"
              variant="secondary"
              onPress={() =>
                router.push(`/(app)/weddings/${weddingId}/timeline/${next.id}` as Href)
              }
            />
          </Card>
        ) : null}

        <View style={styles.chips}>
          <Chip label="List" active={viewMode === 'list'} onPress={() => setViewMode('list')} />
          <Chip
            label="Calendar"
            active={viewMode === 'calendar'}
            onPress={() => {
              setViewMode('calendar');
              setSelectedDateKey((current) => current ?? todayDateKey(timeZone));
            }}
          />
        </View>

        {viewMode === 'list' ? (
          <>
            <View style={styles.chips}>
              {(['upcoming', 'past', 'all'] as EventFilter[]).map((value) => (
                <Chip
                  key={value}
                  label={value === 'all' ? 'All' : value === 'past' ? 'Past' : 'Upcoming'}
                  active={filter === value}
                  onPress={() => setFilter(value)}
                />
              ))}
            </View>
            {listEvents.length === 0 ? (
              <Card style={styles.empty}>
                <AppText variant="subtitle">No events yet</AppText>
                <AppText variant="body" color="textMuted">
                  Add ceremonies, rehearsals, and receptions to build your wedding timeline.
                </AppText>
              </Card>
            ) : (
              <View style={styles.list}>
                {listEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    timeZone={timeZone}
                    onOpen={(id) =>
                      router.push(`/(app)/weddings/${weddingId}/timeline/${id}` as Href)
                    }
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <Card style={styles.calendarCard}>
            <CalendarMonth
              monthKey={resolvedMonth}
              days={calendarDays}
              selectedDateKey={selectedDateKey}
              timeZone={timeZone}
              onPrev={() => setMonthKey(addMonths(resolvedMonth, -1))}
              onNext={() => setMonthKey(addMonths(resolvedMonth, 1))}
              onSelectDate={setSelectedDateKey}
            />
            <View style={styles.dayEvents}>
              <AppText variant="label">
                {selectedDateKey ? `Events on ${selectedDateKey}` : 'Select a date'}
              </AppText>
              {selectedDateKey && selectedEvents.length === 0 ? (
                <AppText color="textMuted">No events on this day.</AppText>
              ) : null}
              {selectedEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  timeZone={timeZone}
                  onOpen={(id) =>
                    router.push(`/(app)/weddings/${weddingId}/timeline/${id}` as Href)
                  }
                />
              ))}
            </View>
          </Card>
        )}

        {canWrite ? (
          <Button
            label="Add event"
            onPress={() => router.push(`/(app)/weddings/${weddingId}/timeline/new` as Href)}
          />
        ) : null}
        </View>
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <AppText variant="caption" color={active ? 'onSuccess' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  stack: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  nextCard: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  list: {
    gap: spacing.md,
  },
  empty: {
    gap: spacing.sm,
  },
  calendarCard: {
    gap: spacing.lg,
  },
  dayEvents: {
    gap: spacing.md,
  },
  block: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
  });
}
