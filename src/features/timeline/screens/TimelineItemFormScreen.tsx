import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { AppTimePicker } from '@/components/ui/AppTimePicker';
import { TextField } from '@/components/ui/TextField';
import {
  useDeleteTimelineItem,
  useSaveTimelineItem,
  useTimelineItems,
} from '@/features/timeline/queries';
import type { TimelineItemWithAssignee } from '@/features/timeline/types';
import { DEFAULT_WEDDING_TIMEZONE } from '@/features/timeline/utils/datetime';
import { splitTimestamp, timelineFormToTimestamps } from '@/features/timeline/utils/formTimes';
import { findOverlappingItems } from '@/features/timeline/utils/timelineHelpers';
import {
  fieldErrorsFromZod,
  timelineItemFormSchema,
} from '@/features/timeline/validation/timelineSchemas';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function TimelineItemFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  const { weddingId, eventId, itemId } = useLocalSearchParams<{
    weddingId: string;
    eventId: string;
    itemId?: string;
  }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/timeline/${eventId}`);
  const itemsQuery = useTimelineItems(weddingId, eventId);
  const item = useMemo(
    () => (mode === 'edit' ? itemsQuery.data?.find((row) => row.id === itemId) : undefined),
    [mode, itemsQuery.data, itemId],
  );
  const title = mode === 'create' ? 'Add schedule item' : 'Edit schedule item';

  if (!weddingId || !eventId || (mode === 'edit' && !itemId)) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing schedule item.</AppText>
      </Screen>
    );
  }

  if (mode === 'edit' && itemsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <FormSkeleton />
      </Screen>
    );
  }

  if (mode === 'edit' && !item) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <AppText color="danger">Schedule item unavailable.</AppText>
        <Button label="Retry" onPress={() => void itemsQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <TimelineItemForm
      key={item?.id ?? 'new'}
      mode={mode}
      weddingId={weddingId}
      eventId={eventId}
      item={item}
      allItems={itemsQuery.data ?? []}
      title={title}
      onBack={goBack}
    />
  );
}

function TimelineItemForm({
  mode,
  weddingId,
  eventId,
  item,
  allItems,
  title,
  onBack,
}: {
  mode: 'create' | 'edit';
  weddingId: string;
  eventId: string;
  item?: TimelineItemWithAssignee;
  allItems: TimelineItemWithAssignee[];
  title: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const save = useSaveTimelineItem(weddingId, eventId);
  const remove = useDeleteTimelineItem(weddingId, eventId);
  const timeZone = wedding.data?.timezone ?? DEFAULT_WEDDING_TIMEZONE;

  const start = splitTimestamp(item?.starts_at, timeZone);
  const end = splitTimestamp(item?.ends_at, timeZone);

  const [itemTitle, setItemTitle] = useState(item?.title ?? '');
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function persist(values: {
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    notes: string | null;
  }) {
    save.mutate(
      mode === 'create'
        ? { mode: 'create', values }
        : { mode: 'edit', itemId: item!.id, values },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => router.back(),
      },
    );
  }

  function onSubmit() {
    if (!canWrite || save.isPending) return;
    setFormError(null);
    const parsed = timelineItemFormSchema.safeParse({
      title: itemTitle,
      startDate,
      startTime,
      endDate,
      endTime,
      notes,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    const times = timelineFormToTimestamps(parsed.data, timeZone);
    if (times.error) {
      setFieldErrors({ endTime: times.error });
      return;
    }
    setFieldErrors({});

    const overlaps = findOverlappingItems(allItems, {
      id: item?.id,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
    });

    const values = {
      title: parsed.data.title,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      notes: parsed.data.notes,
    };

    if (overlaps.length > 0) {
      Alert.alert(
        'Overlapping times',
        `This overlaps with: ${overlaps.map((row) => row.title).join(', ')}. Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: () => persist(values) },
        ],
      );
      return;
    }

    persist(values);
  }

  function onDelete() {

    if (!canWrite || !item || remove.isPending) return;
    Alert.alert('Delete schedule item?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(item.id, {
            onSuccess: () => router.back(),
            onError: (error) => Alert.alert('Could not delete', errorMessage(error)),
          }),
      },
    ]);
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title={title} showBack onBack={onBack} />
      <View style={styles.form}>
        <AppText variant="caption" color="textMuted">
          Schedule items belong to this event. Times use {timeZone}. Location lives on the parent
          event (timeline items have no location column).
        </AppText>
        <TextField
          label="Title"
          value={itemTitle}
          onChangeText={setItemTitle}
          error={fieldErrors.title}
          editable={canWrite && !save.isPending}
        />
        <AppDatePicker
          label="Start date"
          value={startDate}
          onChange={setStartDate}
          onClear={() => setStartDate('')}
          error={fieldErrors.startDate}
          disabled={!canWrite || save.isPending}
        />
        <AppTimePicker
          label="Start time"
          value={startTime}
          onChange={setStartTime}
          onClear={() => setStartTime('')}
          error={fieldErrors.startTime}
          disabled={!canWrite || save.isPending}
        />
        <AppDatePicker
          label="End date (optional)"
          value={endDate}
          onChange={setEndDate}
          onClear={() => setEndDate('')}
          error={fieldErrors.endDate}
          disabled={!canWrite || save.isPending}
        />
        <AppTimePicker
          label="End time (optional)"
          value={endTime}
          onChange={setEndTime}
          onClear={() => setEndTime('')}
          error={fieldErrors.endTime}
          disabled={!canWrite || save.isPending}
        />
        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          editable={canWrite && !save.isPending}
        />
        {formError ? <AppText color="danger">{formError}</AppText> : null}
        {canWrite ? (
          <>
            <Button
              label={mode === 'create' ? 'Add item' : 'Save changes'}
              loading={save.isPending}
              onPress={onSubmit}
            />
            {mode === 'edit' ? (
              <Button
                label="Delete item"
                variant="secondary"
                loading={remove.isPending}
                onPress={onDelete}
              />
            ) : null}
          </>
        ) : (
          <AppText color="textMuted">Viewers cannot edit the schedule.</AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
});
