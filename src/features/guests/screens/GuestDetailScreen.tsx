import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { TaskDetailSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { EventQuickAdd } from '@/features/guests/components/EventQuickAdd';
import {
  useDeleteGuest,
  useGuest,
  useGuestRsvps,
  useInvitations,
  useSetGuestRsvp,
  useWeddingEvents,
} from '@/features/guests/queries';
import type { RsvpResponse } from '@/features/guests/types';
import {
  guestRsvpStatus,
  guestTypeLabel,
  invitationStatusLabel,
  invitationStatusTone,
  rsvpLabel,
  rsvpTone,
  sideLabel,
} from '@/features/guests/utils/guestHelpers';
import { useWeddingRole } from '@/features/weddings/queries';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

const RESPONSES: { id: RsvpResponse; label: string }[] = [
  { id: 'yes', label: 'Attending' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: 'Declined' },
  { id: 'pending', label: 'Pending' },
];

export function GuestDetailScreen() {
  const styles = useThemedStyles(createStyles);

  const router = useRouter();
  const { weddingId, guestId } = useLocalSearchParams<{ weddingId: string; guestId: string }>();
  const base = `/(app)/weddings/${weddingId}/guests`;
  const goBack = useBackTo(base);

  const guestQuery = useGuest(weddingId, guestId);
  const eventsQuery = useWeddingEvents(weddingId);
  const rsvpsQuery = useGuestRsvps(weddingId);
  const invitationsQuery = useInvitations(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const removeGuest = useDeleteGuest(weddingId ?? '');
  const setRsvp = useSetGuestRsvp(weddingId ?? '');

  const [error, setError] = useState<string | null>(null);

  const guest = guestQuery.data;
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const rsvps = useMemo(() => rsvpsQuery.data ?? [], [rsvpsQuery.data]);

  const guestGroupId = guest ? guest.group_id : null;
  const invitations = useMemo(
    () =>
      (invitationsQuery.data ?? []).filter(
        (item) => item.guest_id === guestId || (guestGroupId != null && item.group_id === guestGroupId),
      ),
    [invitationsQuery.data, guestId, guestGroupId],
  );

  function onDelete() {
    if (!guest || !canWrite) return;
    Alert.alert(
      'Delete guest?',
      'Their RSVPs and seating are removed, and invitations addressed only to them stop working. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setError(null);
            removeGuest.mutate(guest.id, {
              onError: (mutationError) => setError(errorMessage(mutationError)),
              onSuccess: goBack,
            });
          },
        },
      ],
    );
  }

  function onSetRsvp(eventId: string, response: RsvpResponse) {

    if (!guest || !canWrite || setRsvp.isPending) return;
    setError(null);
    setRsvp.mutate(
      { guestId: guest.id, eventId, response },
      { onError: (mutationError) => setError(errorMessage(mutationError)) },
    );
  }

  if (guestQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Guest" showBack onBack={goBack} />
        <TaskDetailSkeleton />
      </Screen>
    );
  }

  if (!guest) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Guest" showBack onBack={goBack} />
        <View style={styles.actions}>
          <AppText color="danger" style={styles.center}>
            {guestQuery.error ? errorMessage(guestQuery.error) : 'Guest unavailable'}
          </AppText>
          <Button label="Retry" loading={guestQuery.isFetching} onPress={() => void guestQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  const busy = removeGuest.isPending;

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Guest" showBack onBack={goBack} />
      <RefreshNotice
        error={guestQuery.isRefetchError ? guestQuery.error : null}
        onRetry={() => void guestQuery.refetch()}
      />

      <Card style={styles.card}>
        <AppText variant="title">{guest.full_name}</AppText>
        <View style={styles.badges}>
          {guest.group ? <Badge label={guest.group.name} tone="primary" /> : null}
          {guest.plus_one_allowed ? <Badge label="Plus one allowed" tone="info" /> : null}
        </View>
        <Detail label="Phone" value={guest.phone ?? 'Not set'} />
        <Detail label="Email" value={guest.email ?? 'Not set'} />
        <Detail label="Side" value={sideLabel(guest.side)} />
        <Detail label="Guest type" value={guestTypeLabel(guest.guest_type)} />
        {guest.dietary_notes ? <Detail label="Dietary notes" value={guest.dietary_notes} /> : null}
        {guest.notes ? <Detail label="Notes" value={guest.notes} /> : null}
        <Detail label="Added" value={formatWeddingDateLabel(guest.created_at.slice(0, 10)) ?? 'Unknown'} />
      </Card>

      <AuthFormError message={error} />

      {canWrite ? (
        <View style={styles.actions}>
          <Button
            label="Create invitation"
            disabled={busy}
            onPress={() => router.push(`${base}/invite?guestId=${guest.id}` as Href)}
          />
          <Button
            label="Edit guest"
            variant="secondary"
            disabled={busy}
            onPress={() => router.push(`${base}/${guest.id}/edit` as Href)}
          />
          <Button label="Delete guest" variant="danger" loading={busy} onPress={onDelete} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="label">RSVP</AppText>
        {eventsQuery.isPending ? (
          <AppText variant="caption" color="textMuted">
            Loading events...
          </AppText>
        ) : events.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No events yet. Add an event to record RSVPs.
          </AppText>
        ) : (
          events.map((event) => {
            const current = guestRsvpStatus(guest.id, rsvps, event.id);
            return (
              <View key={event.id} style={styles.eventBlock}>
                <View style={styles.eventHeader}>
                  <AppText variant="bodyMedium" style={styles.eventName}>
                    {event.name}
                  </AppText>
                  <Badge label={rsvpLabel(current)} tone={rsvpTone(current)} />
                </View>
                {canWrite ? (
                  <View style={styles.chips}>
                    {RESPONSES.map((response) => (
                      <Chip
                        key={response.id}
                        label={response.label}
                        selected={current === response.id}
                        disabled={setRsvp.isPending}
                        onPress={() => onSetRsvp(event.id, response.id)}
                        tone="success"
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      {canWrite && !eventsQuery.isPending && events.length === 0 ? (
        <View style={styles.section}>
          <EventQuickAdd weddingId={weddingId} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="label">Invitations</AppText>
        {invitationsQuery.isPending ? (
          <AppText variant="caption" color="textMuted">
            Loading invitations...
          </AppText>
        ) : invitations.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No invitation created for this guest yet.
          </AppText>
        ) : (
          invitations.map((invitation) => (
            <View key={invitation.id} style={styles.invitationRow}>
              <View style={styles.invitationText}>
                <AppText variant="caption" color="textMuted">
                  {invitation.guest_id ? 'Personal invitation' : `Group: ${invitation.group?.name ?? 'Group'}`}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  {invitation.sent_at
                    ? `Shared ${formatWeddingDateLabel(invitation.sent_at.slice(0, 10)) ?? ''}`
                    : 'Not shared yet'}
                </AppText>
              </View>
              <Badge
                label={invitationStatusLabel(invitation.status)}
                tone={invitationStatusTone(invitation.status)}
              />
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detail}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ color: colors.text }}>
        {value}
      </AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  card: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  detail: {
    gap: spacing.xxs,
  },
  actions: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  eventBlock: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eventName: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  invitationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  invitationText: {
    flex: 1,
    gap: spacing.xxs,
  },
  center: {
    textAlign: 'center',
  },
  });
}
