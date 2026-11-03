import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { InvitationPreviewCard } from '@/features/guests/components/InvitationPreviewCard';
import { usePublicInvite, useSubmitPublicRsvp } from '@/features/guests/queries';
import type { PublicInviteEvent, PublicInviteGuest, RsvpResponse } from '@/features/guests/types';
import { rsvpLabel, rsvpTone } from '@/features/guests/utils/guestHelpers';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { QueryError, errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

const RESPONSES: { id: RsvpResponse; label: string }[] = [
  { id: 'yes', label: 'Attending' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'no', label: 'Cannot attend' },
];

function eventMeta(event: PublicInviteEvent): string {
  const when = event.starts_at ? formatWeddingDateLabel(event.starts_at.slice(0, 10)) : null;
  return [when, event.venue_name, event.city].filter(Boolean).join(' - ');
}

/**
 * Public, token-authorised invitation. Works signed out (RPCs are granted to anon) and is not
 * redirected away when signed in. The token comes from the route and is never logged or shown.
 */
export function PublicInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const invite = usePublicInvite(token);
  const submit = useSubmitPublicRsvp(token);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = invite.data;
  const guestCount = preview?.guests.length ?? 0;

  const coupleNames = useMemo(
    () =>
      preview
        ? [preview.wedding.partner_one_name, preview.wedding.partner_two_name].filter(Boolean).join(' & ') ||
          preview.wedding.title
        : '',
    [preview],
  );

  function onRespond(guest: PublicInviteGuest, event: PublicInviteEvent, response: RsvpResponse) {

    if (submit.isPending) return;
    setError(null);
    setPendingKey(`${guest.id}:${event.id}`);
    submit.mutate(
      { guestId: guest.id, eventId: event.id, response },
      {
        onError: (mutationError) => setError(errorMessage(mutationError)),
        onSettled: () => setPendingKey(null),
      },
    );
  }

  if (!token) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <InviteMessage title="Invitation link incomplete" body="This link is missing its invitation code." />
      </Screen>
    );
  }

  if (invite.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <View style={styles.stack} accessibilityLabel="Loading invitation">
          <Skeleton width="100%" height={320} radius={radii.xl} />
          <Skeleton width="60%" height={20} />
          <Skeleton width="100%" height={96} radius={radii.lg} />
        </View>
      </Screen>
    );
  }

  if (!preview) {
    const code = invite.error instanceof QueryError ? invite.error.code : 'unknown';
    if (code === 'cancelled') {
      return (
        <Screen>
          <StatusBar style="dark" />
          <InviteMessage
            title="Invitation cancelled"
            body="This invitation is no longer active. Please contact the couple if you think this is a mistake."
          />
        </Screen>
      );
    }
    if (code === 'invalid_token') {
      return (
        <Screen>
          <StatusBar style="dark" />
          <InviteMessage
            title="Invitation not found"
            body="This invitation link is not valid. Check that you copied the whole link, or ask the couple to send it again."
          />
        </Screen>
      );
    }
    return (
      <Screen>
        <StatusBar style="dark" />
        <InviteMessage title="Could not load invitation" body={errorMessage(invite.error)}>
          <Button label="Try again" loading={invite.isFetching} onPress={() => void invite.refetch()} />
        </InviteMessage>
      </Screen>
    );
  }

  const location = [preview.wedding.city, preview.wedding.country_code].filter(Boolean).join(', ');

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <View style={styles.stack}>
        <RefreshNotice
          error={invite.isRefetchError ? invite.error : null}
          onRetry={() => void invite.refetch()}
        />
        <InvitationPreviewCard
          design={preview.design?.design_data ?? null}
          coupleNames={coupleNames}
          dateLabel={formatWeddingDateLabel(preview.wedding.wedding_date) ?? null}
          locationLabel={location || null}
          eventNames={preview.events.map((event) => event.name)}
          guestName={guestCount === 1 ? preview.guests[0].full_name : null}
        />

        <AppText variant="title">RSVP</AppText>
        {guestCount === 0 ? (
          <AppText color="textMuted">No guests are listed on this invitation yet.</AppText>
        ) : preview.events.length === 0 ? (
          <AppText color="textMuted">
            The couple has not added any events to respond to yet. Please check back later.
          </AppText>
        ) : (
          preview.guests.map((guest) => (
            <Card key={guest.id} style={styles.card}>
              <AppText variant="subtitle">{guest.full_name}</AppText>
              {guest.plus_one_allowed ? (
                <AppText variant="caption" color="textMuted">
                  A plus one is welcome. Please tell the couple directly who will join you.
                </AppText>
              ) : null}
              {preview.events.map((event) => {
                const current =
                  guest.rsvps.find((rsvp) => rsvp.event_id === event.id)?.response ?? 'pending';
                const busy = pendingKey === `${guest.id}:${event.id}`;
                return (
                  <View key={event.id} style={styles.eventBlock}>
                    <View style={styles.eventHeader}>
                      <View style={styles.flex}>
                        <AppText variant="bodyMedium">{event.name}</AppText>
                        {eventMeta(event) ? (
                          <AppText variant="caption" color="textMuted">
                            {eventMeta(event)}
                          </AppText>
                        ) : null}
                      </View>
                      <Badge label={busy ? 'Saving...' : rsvpLabel(current)} tone={rsvpTone(current)} />
                    </View>
                    <View style={styles.chips}>
                      {RESPONSES.map((response) => (
                        <Chip
                          key={response.id}
                          label={response.label}
                          selected={current === response.id}
                          disabled={submit.isPending}
                          onPress={() => onRespond(guest, event, response.id)}
                          tone="success"
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </Card>
          ))
        )}
        <AuthFormError message={error} />
        <AppText variant="caption" color="textMuted" style={styles.center}>
          You can change your response at any time using this same link.
        </AppText>
      </View>
    </Screen>
  );
}

function InviteMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {

  return (
    <View style={styles.message}>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText color="textMuted" style={styles.center}>
        {body}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  eventBlock: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});
