import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TimelineItemRow } from '@/features/timeline/components/TimelineItemRow';
import {
  useDeleteWeddingEvent,
  useEventRelatedBookings,
  useEventRelatedTasks,
  useReorderTimelineItems,
  useTimelineItems,
  useWeddingEvent,
} from '@/features/timeline/queries';
import { DEFAULT_WEDDING_TIMEZONE, formatEventWhen } from '@/features/timeline/utils/datetime';
import {
  eventTypeLabel,
  findOverlappingItems,
  locationLabel,
  sortTimelineItems,
} from '@/features/timeline/utils/timelineHelpers';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function EventDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, eventId } = useLocalSearchParams<{ weddingId: string; eventId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/timeline`);
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const eventQuery = useWeddingEvent(weddingId, eventId);
  const itemsQuery = useTimelineItems(weddingId, eventId);
  const tasksQuery = useEventRelatedTasks(weddingId, eventId);
  const bookingsQuery = useEventRelatedBookings(weddingId, eventId);
  const remove = useDeleteWeddingEvent(weddingId ?? '');
  const reorder = useReorderTimelineItems(weddingId ?? '', eventId ?? '');

  const timeZone = wedding.data?.timezone ?? DEFAULT_WEDDING_TIMEZONE;
  const items = useMemo(
    () => sortTimelineItems(itemsQuery.data ?? []),
    [itemsQuery.data],
  );
  const overlaps = useMemo(() => {
    const warnings: string[] = [];
    for (const item of items) {
      if (!item.starts_at) continue;
      const hits = findOverlappingItems(items, {
        id: item.id,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
      });
      if (hits.length > 0) {
        warnings.push(`${item.title} overlaps ${hits.map((h) => h.title).join(', ')}`);
      }
    }
    return [...new Set(warnings)];
  }, [items]);

  if (!weddingId || !eventId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing event.</AppText>
      </Screen>
    );
  }

  const header = <Header title="Event" showBack onBack={goBack} />;

  if (eventQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton />
      </Screen>
    );
  }

  if (!eventQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <AppText color="danger">{errorMessage(eventQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void eventQuery.refetch()} />
      </Screen>
    );
  }

  const event = eventQuery.data;
  const location = locationLabel(event);

  function onDelete() {
    if (!canWrite || remove.isPending) return;
    Alert.alert(
      'Delete event?',
      'Wedding-day timeline items for this event will also be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(eventId, {
              onSuccess: () => router.replace(`/(app)/weddings/${weddingId}/timeline` as Href),
              onError: (error) => Alert.alert('Could not delete', errorMessage(error)),
            }),
        },
      ],
    );
  }

  function moveItem(itemId: string, direction: -1 | 1) {

    if (!canWrite || reorder.isPending) return;
    const index = items.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) return;
    const ordered = items.map((item) => item.id);
    const swap = ordered[target];
    ordered[target] = ordered[index];
    ordered[index] = swap;
    reorder.mutate(ordered, {
      onError: (error) => Alert.alert('Could not reorder', errorMessage(error)),
    });
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={eventQuery.isRefetchError ? eventQuery.error : null}
        onRetry={() => void eventQuery.refetch()}
      />

      <View style={styles.stack}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <AppText variant="title" style={styles.title}>
              {event.name}
            </AppText>
            <Badge label={eventTypeLabel(event.event_type)} tone="primary" />
          </View>
          <AppText variant="body" color="textMuted">
            {formatEventWhen(event.starts_at, event.ends_at, timeZone)}
          </AppText>
          {location ? (
            <AppText variant="caption" color="textSubtle">
              {location}
            </AppText>
          ) : null}
          {event.notes ? (
            <AppText variant="body" color="textMuted">
              {event.notes}
            </AppText>
          ) : null}
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="label">Wedding-day schedule</AppText>
            {canWrite ? (
              <Button
                label="Add item"
                variant="secondary"
                fullWidth={false}
                onPress={() =>
                  router.push(
                    `/(app)/weddings/${weddingId}/timeline/${eventId}/items/new` as Href,
                  )
                }
              />
            ) : null}
          </View>
          {overlaps.length > 0 ? (
            <Card style={styles.warn}>
              <AppText variant="caption" color="warning">
                Overlaps detected: {overlaps.join(' · ')}
              </AppText>
            </Card>
          ) : null}
          {itemsQuery.isPending ? (
            <AppText color="textMuted">Loading schedule…</AppText>
          ) : items.length === 0 ? (
            <Card>
              <AppText color="textMuted">
                No schedule items yet. Add preparation, ceremony, and reception moments.
              </AppText>
            </Card>
          ) : (
            <View style={styles.list}>
              {items.map((item, index) => (
                <TimelineItemRow
                  key={item.id}
                  item={item}
                  timeZone={timeZone}
                  canReorder={canWrite}
                  onOpen={(id) =>
                    router.push(
                      `/(app)/weddings/${weddingId}/timeline/${eventId}/items/${id}` as Href,
                    )
                  }
                  onMoveUp={index > 0 ? () => moveItem(item.id, -1) : undefined}
                  onMoveDown={index < items.length - 1 ? () => moveItem(item.id, 1) : undefined}
                />
              ))}
            </View>
          )}
        </View>

        {(tasksQuery.data?.length ?? 0) > 0 ? (
          <Card style={styles.card}>
            <AppText variant="label">Linked checklist tasks</AppText>
            {tasksQuery.data!.map((task) => (
              <AppText key={task.id} variant="body" color="textMuted">
                {task.title} · {task.status.replace(/_/g, ' ')}
                {task.due_date ? ` · due ${task.due_date}` : ''}
              </AppText>
            ))}
          </Card>
        ) : null}

        {(bookingsQuery.data?.length ?? 0) > 0 ? (
          <Card style={styles.card}>
            <AppText variant="label">Confirmed vendor bookings</AppText>
            {bookingsQuery.data!.map((booking) => (
              <AppText key={booking.id} variant="body" color="textMuted">
                {booking.vendorName} · {booking.status}
                {booking.booking_date ? ` · ${booking.booking_date}` : ''}
              </AppText>
            ))}
          </Card>
        ) : null}

        <View style={styles.actions}>
          {canWrite ? (
            <>
              <Button
                label="Edit event"
                variant="secondary"
                onPress={() =>
                  router.push(`/(app)/weddings/${weddingId}/timeline/${eventId}/edit` as Href)
                }
              />
              <Button label="Delete event" variant="secondary" loading={remove.isPending} onPress={onDelete} />
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.xl,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  warn: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
  });
}
