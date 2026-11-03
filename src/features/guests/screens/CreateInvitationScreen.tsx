import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { EventQuickAdd } from '@/features/guests/components/EventQuickAdd';
import { GroupChipList } from '@/features/guests/components/GroupChipList';
import { InvitationPreviewCard } from '@/features/guests/components/InvitationPreviewCard';
import {
  useCreateInvitation,
  useGuestGroups,
  useGuestSummaries,
  useInvitationDesigns,
  useMarkInvitationSent,
  useWeddingEvents,
} from '@/features/guests/queries';
import { filterGuests, parseDesignData } from '@/features/guests/utils/guestHelpers';
import { createInvitationSchema } from '@/features/guests/validation/guestSchemas';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type Target = 'guest' | 'group';

/** Held in component state only. Never logged, persisted or placed in a query cache. */
type CreatedShare = { invitationId: string; link: string };

const MAX_GUEST_MATCHES = 8;

export function CreateInvitationScreen() {
  const styles = useThemedStyles(createStyles);

  const router = useRouter();
  const params = useLocalSearchParams<{ weddingId: string; guestId?: string; groupId?: string }>();
  const { weddingId } = params;
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const { canWrite, isLoading: roleLoading } = useWeddingRole(weddingId);

  const wedding = useWedding(weddingId);
  const summariesQuery = useGuestSummaries(weddingId);
  const groupsQuery = useGuestGroups(weddingId);
  const designsQuery = useInvitationDesigns(weddingId);
  const eventsQuery = useWeddingEvents(weddingId);
  const create = useCreateInvitation(weddingId ?? '');
  const markSent = useMarkInvitationSent(weddingId ?? '');

  const [target, setTarget] = useState<Target>(params.groupId ? 'group' : 'guest');
  const [guestId, setGuestId] = useState<string | null>(params.guestId ?? null);
  const [groupId, setGroupId] = useState<string | null>(params.groupId ?? null);
  const [search, setSearch] = useState('');
  const [designId, setDesignId] = useState<string | null>(null);
  // null = untouched, which means "all events" once they load.
  const [pickedEventIds, setPickedEventIds] = useState<string[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [share, setShare] = useState<CreatedShare | null>(null);
  const [shared, setShared] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const summaries = useMemo(() => summariesQuery.data ?? [], [summariesQuery.data]);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const designs = useMemo(() => designsQuery.data ?? [], [designsQuery.data]);
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  const eventIds = pickedEventIds ?? events.map((event) => event.id);
  const selectedGuest = summaries.find((guest) => guest.id === guestId) ?? null;
  const selectedGroup = groups.find((group) => group.id === groupId) ?? null;
  const selectedDesign = designs.find((design) => design.id === designId) ?? null;
  const selectedEvents = events.filter((event) => eventIds.includes(event.id));

  const matches = useMemo(
    () =>
      search.trim()
        ? filterGuests(summaries, [], { query: search }).slice(0, MAX_GUEST_MATCHES)
        : summaries.slice(0, MAX_GUEST_MATCHES),
    [summaries, search],
  );

  const coupleNames = wedding.data
    ? `${wedding.data.partner_one_name} & ${wedding.data.partner_two_name}`
    : 'Your names';

  function toggleEvent(eventId: string) {
    setPickedEventIds((current) => {
      const base = current ?? events.map((event) => event.id);
      return base.includes(eventId) ? base.filter((id) => id !== eventId) : [...base, eventId];
    });
  }

  function onCreate() {
    if (create.isPending || !weddingId) return;
    setFormError(null);
    const parsed = createInvitationSchema.safeParse({
      guestId: target === 'guest' ? (guestId ?? undefined) : undefined,
      groupId: target === 'group' ? (groupId ?? undefined) : undefined,
      designId: designId ?? undefined,
      eventIds,
    });
    if (!parsed.success) {
      setFormError(target === 'guest' ? 'Choose a guest to invite.' : 'Choose a group to invite.');
      return;
    }
    create.mutate(
      {
        guestId: parsed.data.guestId,
        groupId: parsed.data.groupId,
        designId: parsed.data.designId,
        eventIds: parsed.data.eventIds,
      },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: (created) => {
          setShare({
            invitationId: created.invitationId,
            link: Linking.createURL(`/invite/${created.rawToken}`),
          });
          setShared(false);
          // Drop the raw token from the mutation cache; the link now lives only in this state.
          create.reset();
        },
      },
    );
  }

  async function onShare() {

    if (!share) return;
    setShareError(null);
    try {
      // Share the link only. This is a hand-off to the OS share sheet, not delivery.
      const result = await Share.share({ message: share.link });
      if (result.action === Share.sharedAction) {
        markSent.mutate(share.invitationId, {
          onSuccess: () => setShared(true),
          onError: (error) => setShareError(errorMessage(error)),
        });
      }
    } catch {
      setShareError('Sharing is not available here. Try again on a device with a share sheet.');
    }
  }

  const header = <Header title="Invite guests" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (roleLoading || summariesQuery.isPending || eventsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={3} />
      </Screen>
    );
  }

  if (!canWrite) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <AppText color="textMuted" style={styles.center}>
          Only writers can create invitations for this wedding.
        </AppText>
      </Screen>
    );
  }

  if (share) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Invitation ready" />
        <View style={styles.stack}>
          <Card style={styles.card}>
            <AppText variant="subtitle">Your invitation link is ready</AppText>
            <AppText color="textMuted">
              Share it with your guest using any app. Kiburan does not send SMS or email for you, and it
              cannot tell when a message is delivered.
            </AppText>
            <View style={styles.linkBox}>
              <AppText variant="caption" selectable numberOfLines={3}>
                {share.link}
              </AppText>
            </View>
            <AppText variant="caption" color="warning">
              This link is shown only now and cannot be recovered later. Share it before leaving this screen.
            </AppText>
          </Card>
          {shared ? (
            <AppText variant="caption" color="success" style={styles.center}>
              Marked as shared. You can follow its status in Tracking.
            </AppText>
          ) : null}
          <AuthFormError message={shareError} />
          <Button
            label={shared ? 'Share again' : 'Share invitation link'}
            loading={markSent.isPending}
            onPress={() => void onShare()}
          />
          <Button
            label="Done"
            variant="secondary"
            onPress={() => router.replace(`/(app)/weddings/${weddingId}/guests/tracking` as Href)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      {header}
      <View style={styles.stack}>
        <Card style={styles.card}>
          <AppText variant="label">Who is this for?</AppText>
          <View style={styles.chips}>
            <Chip label="One guest" selected={target === 'guest'} onPress={() => setTarget('guest')} />
            <Chip label="A group" selected={target === 'group'} onPress={() => setTarget('group')} />
          </View>

          {target === 'guest' ? (
            summaries.length === 0 ? (
              <AppText variant="caption" color="textMuted">
                Add guests first, then create their invitations.
              </AppText>
            ) : (
              <View style={styles.stack}>
                {selectedGuest ? (
                  <View style={styles.selectedRow}>
                    <AppText variant="bodyMedium" style={styles.flex}>
                      {selectedGuest.full_name}
                    </AppText>
                    <Pressable onPress={() => setGuestId(null)} accessibilityRole="button">
                      <AppText variant="caption" color="danger">
                        Change
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <TextField
                      label="Find a guest"
                      value={search}
                      onChangeText={setSearch}
                      placeholder="Search by name"
                      autoCorrect={false}
                    />
                    {matches.map((guest) => (
                      <Pressable
                        key={guest.id}
                        onPress={() => setGuestId(guest.id)}
                        accessibilityRole="button"
                        style={styles.matchRow}>
                        <AppText variant="bodyMedium">{guest.full_name}</AppText>
                      </Pressable>
                    ))}
                    {matches.length === 0 ? (
                      <AppText variant="caption" color="textMuted">
                        No guests match that search.
                      </AppText>
                    ) : null}
                  </>
                )}
              </View>
            )
          ) : groups.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              No groups yet. Create a group to invite a family or friends together.
            </AppText>
          ) : (
            <GroupChipList groups={groups} selectedId={groupId} onSelect={setGroupId} />
          )}
        </Card>

        <Card style={styles.card}>
          <AppText variant="label">Design</AppText>
          {designs.length === 0 ? (
            <>
              <AppText variant="caption" color="textMuted">
                No designs yet. The invitation will use a plain layout until you create one.
              </AppText>
              <Button
                label="Create a design"
                variant="secondary"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/guests/designs` as Href)}
              />
            </>
          ) : (
            <View style={styles.chips}>
              <Chip label="No design" selected={designId === null} onPress={() => setDesignId(null)} tone="success" />
              {designs.map((design) => (
                <Chip
                  key={design.id}
                  label={design.name}
                  selected={designId === design.id}
                  onPress={() => setDesignId(design.id)}
                  tone="success"
                />
              ))}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <AppText variant="label">Events</AppText>
          {events.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              No events yet. Add one so guests can RSVP to it.
            </AppText>
          ) : (
            <>
              <AppText variant="caption" color="textMuted">
                Guests can RSVP to the events you select. If you select none, they can respond to every event.
              </AppText>
              <View style={styles.chips}>
                {events.map((event) => (
                  <Chip
                    key={event.id}
                    label={event.name}
                    selected={eventIds.includes(event.id)}
                    onPress={() => toggleEvent(event.id)}
                    tone="success"
                  />
                ))}
              </View>
            </>
          )}
        </Card>

        {events.length === 0 ? <EventQuickAdd weddingId={weddingId} /> : null}

        <AppText variant="label">Preview</AppText>
        <InvitationPreviewCard
          design={selectedDesign ? parseDesignData(selectedDesign.design_data) : null}
          coupleNames={coupleNames}
          dateLabel={formatWeddingDateLabel(wedding.data?.wedding_date) ?? null}
          locationLabel={[wedding.data?.city, wedding.data?.country_code].filter(Boolean).join(', ') || null}
          eventNames={selectedEvents.map((event) => event.name)}
          guestName={target === 'guest' ? selectedGuest?.full_name : selectedGroup?.name}
        />

        <AuthFormError message={formError} />
        <Button label="Create invitation" loading={create.isPending} onPress={onCreate} />
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  card: {
    gap: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.successMuted,
  },
  matchRow: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  linkBox: {
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  center: {
    textAlign: 'center',
  },
  });
}
