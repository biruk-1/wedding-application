import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { EventQuickAdd } from '@/features/guests/components/EventQuickAdd';
import {
  useAssignGuest,
  useDeleteSeatingTable,
  useGuestRsvps,
  useGuestSummaries,
  useSaveSeatingTable,
  useSeatingAssignments,
  useSeatingTables,
  useUnassignGuest,
  useWeddingEvents,
} from '@/features/guests/queries';
import type { SeatingTable } from '@/features/guests/types';
import {
  buildRsvpStatusMap,
  rsvpLabel,
  rsvpTone,
  tableOccupancy,
} from '@/features/guests/utils/guestHelpers';
import { fieldErrorsFromZod, tableFormSchema } from '@/features/guests/validation/guestSchemas';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const MAX_UNASSIGNED_SHOWN = 60;

export function SeatingScreen() {
  const styles = useThemedStyles(createStyles);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const { canWrite } = useWeddingRole(weddingId);

  const eventsQuery = useWeddingEvents(weddingId);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const [pickedEventId, setPickedEventId] = useState<string | null>(null);
  const eventId = events.find((event) => event.id === pickedEventId)?.id ?? events[0]?.id ?? null;

  const header = <Header title="Seating" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (eventsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={2} />
      </Screen>
    );
  }

  if (eventsQuery.isError && !eventsQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(eventsQuery.error)}
          </AppText>
          <Button label="Retry" loading={eventsQuery.isFetching} onPress={() => void eventsQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  if (!eventId) {
    return (
      <Screen scroll keyboardAvoiding>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText variant="subtitle" style={styles.center}>
            Add an event to plan seating
          </AppText>
          <AppText color="textMuted" style={styles.center}>
            Seating is arranged per event, for example the reception.
          </AppText>
          {canWrite ? (
            <EventQuickAdd
              weddingId={weddingId}
              title="Add your first event"
              onCreated={(event) => setPickedEventId(event.id)}
            />
          ) : (
            <AppText variant="caption" color="textMuted" style={styles.center}>
              Writers can add events for this wedding.
            </AppText>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <SeatingPlanner
      key={eventId}
      weddingId={weddingId}
      eventId={eventId}
      canWrite={canWrite}
      header={header}
      eventChips={
        <View style={styles.chips}>
          {events.map((event) => (
            <Chip
              key={event.id}
              label={event.name}
              selected={event.id === eventId}
              onPress={() => setPickedEventId(event.id)}
              tone="success"
            />
          ))}
        </View>
      }
    />
  );
}

function SeatingPlanner({
  weddingId,
  eventId,
  canWrite,
  header,
  eventChips,
}: {
  weddingId: string;
  eventId: string;
  canWrite: boolean;
  header: ReactNode;
  eventChips: ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  const tablesQuery = useSeatingTables(weddingId, eventId);
  const assignmentsQuery = useSeatingAssignments(weddingId, eventId);
  const guestsQuery = useGuestSummaries(weddingId);
  const rsvpsQuery = useGuestRsvps(weddingId);

  const saveTable = useSaveSeatingTable(weddingId, eventId);
  const removeTable = useDeleteSeatingTable(weddingId, eventId);
  const assign = useAssignGuest(weddingId, eventId);
  const unassign = useUnassignGuest(weddingId, eventId);

  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [hideDeclined, setHideDeclined] = useState(true);
  const [editing, setEditing] = useState<SeatingTable | null>(null);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const tables = useMemo(() => tablesQuery.data ?? [], [tablesQuery.data]);
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);
  const guests = useMemo(() => guestsQuery.data ?? [], [guestsQuery.data]);
  const rsvps = useMemo(() => rsvpsQuery.data ?? [], [rsvpsQuery.data]);

  const occupancy = useMemo(() => tableOccupancy(tables, assignments), [tables, assignments]);
  const guestsById = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);
  const statusById = useMemo(() => buildRsvpStatusMap(guests, rsvps, eventId), [guests, rsvps, eventId]);
  const seatedIds = useMemo(() => new Set(assignments.map((a) => a.guest_id)), [assignments]);

  const unassigned = useMemo(
    () =>
      guests.filter(
        (guest) => !seatedIds.has(guest.id) && !(hideDeclined && statusById.get(guest.id) === 'no'),
      ),
    [guests, seatedIds, hideDeclined, statusById],
  );

  function resetForm() {
    setEditing(null);
    setName('');
    setCapacity('');
    setFieldErrors({});
  }

  function startEdit(table: SeatingTable) {
    setEditing(table);
    setName(table.name);
    setCapacity(table.capacity ? String(table.capacity) : '');
    setFieldErrors({});
    setError(null);
  }

  function onSaveTable() {
    if (saveTable.isPending) return;
    setError(null);
    const parsed = tableFormSchema.safeParse({ name, capacity });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    const values = { name: parsed.data.name, capacity: parsed.data.capacity ?? null };
    saveTable.mutate(
      editing ? { mode: 'edit', tableId: editing.id, values } : { mode: 'create', values },
      { onError: (e) => setError(errorMessage(e)), onSuccess: resetForm },
    );
  }

  function onDeleteTable(table: SeatingTable) {
    Alert.alert(`Delete ${table.name}?`, 'Guests seated here become unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setError(null);
          removeTable.mutate(table.id, {
            onError: (e) => setError(errorMessage(e)),
            onSuccess: () => {
              if (editing?.id === table.id) resetForm();
            },
          });
        },
      },
    ]);
  }

  function onSeatHere(tableId: string) {
    if (!selectedGuestId || assign.isPending) return;
    setError(null);
    assign.mutate(
      { tableId, guestId: selectedGuestId },
      { onError: (e) => setError(errorMessage(e)), onSuccess: () => setSelectedGuestId(null) },
    );
  }

  function onUnseat(guestId: string) {

    if (unassign.isPending) return;
    setError(null);
    unassign.mutate(guestId, { onError: (e) => setError(errorMessage(e)) });
  }

  if (tablesQuery.isPending || assignmentsQuery.isPending || guestsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        {eventChips}
        <View style={styles.spacer} />
        <FormSkeleton fields={2} />
      </Screen>
    );
  }

  const loadError = (tablesQuery.isError && !tablesQuery.data) || (assignmentsQuery.isError && !assignmentsQuery.data);
  if (loadError) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        {eventChips}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(tablesQuery.error ?? assignmentsQuery.error)}
          </AppText>
          <Button
            label="Retry"
            onPress={() => {
              void tablesQuery.refetch();
              void assignmentsQuery.refetch();
            }}
          />
        </View>
      </Screen>
    );
  }

  const refreshError = tablesQuery.isRefetchError
    ? tablesQuery.error
    : assignmentsQuery.isRefetchError
      ? assignmentsQuery.error
      : null;
  const selectedGuest = selectedGuestId ? guestsById.get(selectedGuestId) : null;

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      {header}
      {eventChips}
      <RefreshNotice
        error={refreshError}
        onRetry={() => {
          void tablesQuery.refetch();
          void assignmentsQuery.refetch();
        }}
      />

      <View style={styles.stack}>
        <AuthFormError message={error} />

        {canWrite ? (
          <Card style={styles.card}>
            <AppText variant="label">{editing ? 'Edit table' : 'Add a table'}</AppText>
            <TextField
              label="Table name"
              placeholder="Table 1"
              value={name}
              onChangeText={setName}
              error={fieldErrors.name}
              editable={!saveTable.isPending}
            />
            <TextField
              label="Capacity"
              value={capacity}
              onChangeText={setCapacity}
              helperText="Optional. Leave empty for no limit."
              error={fieldErrors.capacity}
              editable={!saveTable.isPending}
              keyboardType="number-pad"
            />
            <Button label={editing ? 'Save table' : 'Add table'} loading={saveTable.isPending} onPress={onSaveTable} />
            {editing ? <Button label="Cancel editing" variant="secondary" onPress={resetForm} /> : null}
          </Card>
        ) : null}

        {selectedGuest ? (
          <Card style={[styles.card, styles.selectedBanner]}>
            <AppText variant="bodyMedium">Seating {selectedGuest.full_name}</AppText>
            <AppText variant="caption" color="textMuted">
              Choose Seat here on a table below.
            </AppText>
            <Button label="Clear selection" variant="secondary" onPress={() => setSelectedGuestId(null)} />
          </Card>
        ) : null}

        {occupancy.length === 0 ? (
          <EmptyState
            icon="grid-outline"
            title="No tables yet"
            description={
              canWrite ? 'Add a table above to start seating guests.' : 'Writers can add tables for this event.'
            }
          />
        ) : (
          occupancy.map(({ table, assigned, isFull, isOverCapacity }) => {
            const seated = assignments
              .filter((a) => a.table_id === table.id)
              .map((a) => ({ id: a.guest_id, name: guestsById.get(a.guest_id)?.full_name ?? 'Guest' }))
              .sort((a, b) => a.name.localeCompare(b.name));
            return (
              <Card key={table.id} style={styles.card}>
                <View style={styles.rowHeader}>
                  <AppText variant="bodyMedium" style={styles.flex}>
                    {table.name}
                  </AppText>
                  <Badge
                    label={table.capacity ? `${assigned} / ${table.capacity}` : `${assigned} seated`}
                    tone={isOverCapacity ? 'danger' : isFull ? 'warning' : 'neutral'}
                  />
                </View>
                {isOverCapacity ? (
                  <AppText variant="caption" color="danger">
                    Over capacity by {assigned - (table.capacity ?? 0)}. Move a guest or raise the capacity.
                  </AppText>
                ) : isFull ? (
                  <AppText variant="caption" color="warning">
                    This table is full.
                  </AppText>
                ) : null}
                {seated.length === 0 ? (
                  <AppText variant="caption" color="textMuted">
                    No one seated yet.
                  </AppText>
                ) : (
                  seated.map((person) => (
                    <View key={person.id} style={styles.seatRow}>
                      <AppText variant="body" style={styles.flex} numberOfLines={1}>
                        {person.name}
                      </AppText>
                      {canWrite ? (
                        <Pressable
                          onPress={() => onUnseat(person.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${person.name} from ${table.name}`}>
                          <AppText variant="caption" color="danger">
                            Remove
                          </AppText>
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}
                {canWrite ? (
                  <View style={styles.rowActions}>
                    <Button
                      label={isFull ? 'Full' : 'Seat here'}
                      variant="secondary"
                      fullWidth={false}
                      style={styles.small}
                      disabled={!selectedGuestId || isFull}
                      loading={assign.isPending && assign.variables?.tableId === table.id}
                      onPress={() => onSeatHere(table.id)}
                    />
                    <Button
                      label="Edit"
                      variant="secondary"
                      fullWidth={false}
                      style={styles.small}
                      onPress={() => startEdit(table)}
                    />
                    <Button
                      label="Delete"
                      variant="danger"
                      fullWidth={false}
                      style={styles.small}
                      onPress={() => onDeleteTable(table)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}

        <View style={styles.rowHeader}>
          <AppText variant="label" style={styles.flex}>
            Unassigned guests ({unassigned.length})
          </AppText>
          <Chip
            label="Hide declined"
            selected={hideDeclined}
            onPress={() => setHideDeclined((value) => !value)}
            tone="success"
          />
        </View>
        {guests.length === 0 ? (
          <AppText color="textMuted">Add guests first, then seat them here.</AppText>
        ) : unassigned.length === 0 ? (
          <AppText color="textMuted">Everyone is seated.</AppText>
        ) : (
          unassigned.slice(0, MAX_UNASSIGNED_SHOWN).map((guest) => {
            const status = statusById.get(guest.id) ?? 'pending';
            const selected = guest.id === selectedGuestId;
            return (
              <Pressable
                key={guest.id}
                disabled={!canWrite}
                onPress={() => setSelectedGuestId(selected ? null : guest.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.guestRow, selected && styles.guestRowSelected]}>
                <AppText variant="bodyMedium" style={styles.flex} numberOfLines={1}>
                  {guest.full_name}
                </AppText>
                <Badge label={rsvpLabel(status)} tone={rsvpTone(status)} />
              </Pressable>
            );
          })
        )}
        {unassigned.length > MAX_UNASSIGNED_SHOWN ? (
          <AppText variant="caption" color="textMuted">
            Showing the first {MAX_UNASSIGNED_SHOWN} of {unassigned.length}. Seat some guests to see the rest.
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  spacer: {
    height: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  selectedBanner: {
    borderColor: colors.success,
    borderWidth: 1.5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  small: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  guestRowSelected: {
    borderColor: colors.success,
    borderWidth: 1.5,
    backgroundColor: colors.successMuted,
  },
  center: {
    textAlign: 'center',
  },
  });
}
