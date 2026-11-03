import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { AppTimePicker } from '@/components/ui/AppTimePicker';
import { TextField } from '@/components/ui/TextField';
import { useSaveWeddingEvent, useWeddingEvent } from '@/features/timeline/queries';
import type { WeddingEvent } from '@/features/timeline/types';
import { DEFAULT_WEDDING_TIMEZONE } from '@/features/timeline/utils/datetime';
import { eventFormToTimestamps, splitTimestamp } from '@/features/timeline/utils/formTimes';
import {
  eventFormSchema,
  fieldErrorsFromZod,
  suggestedEventTypes,
} from '@/features/timeline/validation/timelineSchemas';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function EventFormScreen({ mode }: { mode: 'create' | 'edit' }) {

  const { weddingId, eventId } = useLocalSearchParams<{ weddingId: string; eventId?: string }>();
  const goBack = useBackTo(
    mode === 'edit'
      ? `/(app)/weddings/${weddingId}/timeline/${eventId}`
      : `/(app)/weddings/${weddingId}/timeline`,
  );
  const eventQuery = useWeddingEvent(weddingId, mode === 'edit' ? eventId : undefined);
  const title = mode === 'create' ? 'Add event' : 'Edit event';

  if (!weddingId || (mode === 'edit' && !eventId)) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing event.</AppText>
      </Screen>
    );
  }

  if (mode === 'edit' && eventQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <FormSkeleton />
      </Screen>
    );
  }

  if (mode === 'edit' && !eventQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={goBack} />
        <AppText color="danger">{errorMessage(eventQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void eventQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <EventForm
      key={eventQuery.data?.id ?? 'new'}
      mode={mode}
      weddingId={weddingId}
      event={mode === 'edit' ? eventQuery.data : undefined}
      title={title}
      onBack={goBack}
    />
  );
}

function EventForm({
  mode,
  weddingId,
  event,
  title,
  onBack,
}: {
  mode: 'create' | 'edit';
  weddingId: string;
  event?: WeddingEvent;
  title: string;
  onBack: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const save = useSaveWeddingEvent(weddingId);
  const timeZone = wedding.data?.timezone ?? DEFAULT_WEDDING_TIMEZONE;

  const start = splitTimestamp(event?.starts_at, timeZone);
  const end = splitTimestamp(event?.ends_at, timeZone);

  const [name, setName] = useState(event?.name ?? '');
  const [eventType, setEventType] = useState(event?.event_type ?? 'ceremony');
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endDate, setEndDate] = useState(end.date);
  const [endTime, setEndTime] = useState(end.time);
  const [venueName, setVenueName] = useState(event?.venue_name ?? '');
  const [address, setAddress] = useState(event?.address ?? '');
  const [city, setCity] = useState(event?.city ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function onSubmit() {

    if (!canWrite || save.isPending) return;
    setFormError(null);
    const parsed = eventFormSchema.safeParse({
      name,
      eventType,
      startDate,
      startTime,
      endDate,
      endTime,
      venueName,
      address,
      city,
      notes,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    const times = eventFormToTimestamps(parsed.data, timeZone);
    if (times.error) {
      setFieldErrors({ endTime: times.error });
      return;
    }
    setFieldErrors({});
    const values = {
      name: parsed.data.name,
      eventType: parsed.data.eventType,
      startsAt: times.startsAt,
      endsAt: times.endsAt,
      venueName: parsed.data.venueName,
      address: parsed.data.address,
      city: parsed.data.city,
      notes: parsed.data.notes,
    };
    save.mutate(
      mode === 'create' ? { mode: 'create', values } : { mode: 'edit', eventId: event!.id, values },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: (saved) => {
          if (mode === 'create') {
            router.replace(`/(app)/weddings/${weddingId}/timeline/${saved.id}`);
          } else {
            router.back();
          }
        },
      },
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title={title} showBack onBack={onBack} />
      <View style={styles.form}>
        <AppText variant="caption" color="textMuted">
          Times use the wedding timezone ({timeZone}).
        </AppText>
        <TextField
          label="Event name"
          value={name}
          onChangeText={setName}
          error={fieldErrors.name}
          editable={canWrite && !save.isPending}
        />
        <AppText variant="label">Type</AppText>
        <View style={styles.chips}>
          {suggestedEventTypes.map((type) => (
            <Pressable
              key={type}
              onPress={() => setEventType(type)}
              style={[styles.chip, eventType === type && styles.chipActive]}>
              <AppText variant="caption" color={eventType === type ? 'onSuccess' : 'text'}>
                {type.replace(/_/g, ' ')}
              </AppText>
            </Pressable>
          ))}
        </View>
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
          label="Venue"
          value={venueName}
          onChangeText={setVenueName}
          editable={canWrite && !save.isPending}
        />
        <TextField
          label="Address"
          value={address}
          onChangeText={setAddress}
          editable={canWrite && !save.isPending}
        />
        <TextField
          label="City"
          value={city}
          onChangeText={setCity}
          editable={canWrite && !save.isPending}
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
          <Button
            label={mode === 'create' ? 'Create event' : 'Save changes'}
            loading={save.isPending}
            onPress={onSubmit}
          />
        ) : (
          <AppText color="textMuted">Viewers cannot edit events.</AppText>
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
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
  });
}
