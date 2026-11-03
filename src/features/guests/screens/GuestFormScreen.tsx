import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { Chip } from '@/features/guests/components/Chip';
import { GuestCountStepper } from '@/features/guests/components/GuestCountStepper';
import { GuestStatusBadge } from '@/features/guests/components/GuestStatusBadge';
import { GroupChipList } from '@/features/guests/components/GroupChipList';
import {
  useAssignGuest,
  useDeleteGuest,
  useGuest,
  useGuestGroups,
  useGuestRsvps,
  useSaveGuest,
  useSeatingAssignments,
  useSeatingTables,
  useUnassignGuest,
  useWeddingEvents,
} from '@/features/guests/queries';
import type { GuestListItem, GuestSide, GuestType, RsvpResponse } from '@/features/guests/types';
import { guestAvatarTone, guestInitials } from '@/features/guests/utils/guestAvatar';
import {
  GUEST_SIDES,
  GUEST_TYPES,
  guestRsvpStatus,
  guestTypeLabel,
  sideLabel,
} from '@/features/guests/utils/guestHelpers';
import { fieldErrorsFromZod, guestFormSchema } from '@/features/guests/validation/guestSchemas';
import { useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function GuestFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, guestId, groupId } = useLocalSearchParams<{
    weddingId: string;
    guestId?: string;
    groupId?: string;
  }>();
  const { canWrite, isLoading: roleLoading } = useWeddingRole(weddingId);
  const guestQuery = useGuest(weddingId, mode === 'edit' ? guestId : undefined);
  const title = mode === 'create' ? 'New guest' : 'Edit guest';

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if ((mode === 'edit' && guestQuery.isPending) || roleLoading) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={() => router.back()} />
        <FormSkeleton fields={5} />
      </Screen>
    );
  }

  if (!canWrite) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={() => router.back()} />
        <AppText color="textMuted" style={styles.center}>
          You can view guests but only writers can add or edit them.
        </AppText>
      </Screen>
    );
  }

  if (mode === 'edit' && !guestQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title={title} showBack onBack={() => router.back()} />
        <View style={styles.form}>
          <AuthFormError message={guestQuery.error ? errorMessage(guestQuery.error) : 'Guest unavailable'} />
          <Button label="Retry" loading={guestQuery.isFetching} onPress={() => void guestQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  return (
    <GuestForm
      key={guestQuery.data?.id ?? 'new'}
      mode={mode}
      weddingId={weddingId}
      guest={mode === 'edit' ? guestQuery.data : undefined}
      initialGroupId={groupId}
      title={title}
    />
  );
}

function GuestForm({
  mode,
  weddingId,
  guest,
  initialGroupId,
  title,
}: {
  mode: 'create' | 'edit';
  weddingId: string;
  guest: GuestListItem | undefined;
  initialGroupId?: string;
  title: string;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const groupsQuery = useGuestGroups(weddingId);
  const eventsQuery = useWeddingEvents(weddingId);
  const rsvpsQuery = useGuestRsvps(weddingId);
  const save = useSaveGuest(weddingId);
  const removeGuest = useDeleteGuest(weddingId);

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const [seatingEventId, setSeatingEventId] = useState<string | null>(null);
  const activeSeatingEventId = seatingEventId ?? events[0]?.id ?? null;

  const tablesQuery = useSeatingTables(weddingId, activeSeatingEventId);
  const assignmentsQuery = useSeatingAssignments(weddingId, activeSeatingEventId);
  const assign = useAssignGuest(weddingId, activeSeatingEventId ?? '');
  const unassign = useUnassignGuest(weddingId, activeSeatingEventId ?? '');

  const [fullName, setFullName] = useState(guest?.full_name ?? '');
  const [phone, setPhone] = useState(guest?.phone ?? '');
  const [email, setEmail] = useState(guest?.email ?? '');
  const [groupId, setGroupId] = useState<string | null>(guest?.group_id ?? initialGroupId ?? null);
  const [side, setSide] = useState<string>(guest?.side ?? '');
  const [guestType, setGuestType] = useState<string>(guest?.guest_type ?? '');
  const [partySize, setPartySize] = useState(guest?.plus_one_allowed ? 2 : 1);
  const [dietaryNotes, setDietaryNotes] = useState(guest?.dietary_notes ?? '');
  const [notes, setNotes] = useState(guest?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingTableId, setPendingTableId] = useState<string | null | undefined>(undefined);

  const submitting = save.isPending || removeGuest.isPending || assign.isPending || unassign.isPending;
  const groups = groupsQuery.data ?? [];
  const tables = tablesQuery.data ?? [];
  const assignments = useMemo(() => assignmentsQuery.data ?? [], [assignmentsQuery.data]);

  const currentAssignment = useMemo(
    () => (guest ? assignments.find((row) => row.guest_id === guest.id) : undefined),
    [assignments, guest],
  );
  const assignedTableId =
    pendingTableId !== undefined ? pendingTableId : (currentAssignment?.table_id ?? null);

  const rsvp: RsvpResponse | null = guest
    ? guestRsvpStatus(guest.id, rsvpsQuery.data ?? [], activeSeatingEventId)
    : null;

  const avatarTone = guestAvatarTone(guest?.id ?? (fullName || 'new'), colors);
  const displayName = fullName.trim() || guest?.full_name || 'New guest';

  function onSubmit() {
    if (submitting) return;
    setFormError(null);
    const plusOne = partySize >= 2;
    const parsed = guestFormSchema.safeParse({
      fullName,
      phone,
      email,
      groupId: groupId ?? '',
      side,
      guestType,
      plusOneAllowed: plusOne,
      dietaryNotes,
      notes,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});

    const values = {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      groupId: parsed.data.groupId ?? null,
      side: (parsed.data.side as GuestSide | undefined) ?? null,
      guestType: (parsed.data.guestType as GuestType | undefined) ?? null,
      plusOneAllowed: parsed.data.plusOneAllowed,
      dietaryNotes: parsed.data.dietaryNotes ?? null,
      notes: parsed.data.notes ?? null,
    };

    save.mutate(mode === 'create' ? { mode, values } : { mode, guestId: guest!.id, values }, {
      onError: (error) => setFormError(errorMessage(error)),
      onSuccess: (saved) => {
        void syncTableAssignment(saved.id).then((ok) => {
          if (!ok) return;
          if (mode === 'edit') {
            router.back();
            return;
          }
          router.replace(`/(app)/weddings/${weddingId}/guests/${saved.id}` as Href);
        });
      },
    });
  }

  async function syncTableAssignment(guestId: string): Promise<boolean> {
    if (!activeSeatingEventId || pendingTableId === undefined) return true;
    const current = currentAssignment?.table_id ?? null;
    if (pendingTableId === current) return true;
    try {
      if (pendingTableId === null) {
        if (current) await unassign.mutateAsync(guestId);
      } else {
        await assign.mutateAsync({ tableId: pendingTableId, guestId });
      }
      return true;
    } catch (error) {
      setFormError(errorMessage(error));
      return false;
    }
  }

  function onRemove() {
    if (!guest || mode !== 'edit') return;
    Alert.alert(
      'Remove guest?',
      'Their RSVPs and seating are removed, and invitations addressed only to them stop working. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setFormError(null);
            removeGuest.mutate(guest.id, {
              onError: (mutationError) => setFormError(errorMessage(mutationError)),
              onSuccess: goBack,
            });
          },
        },
      ],
    );
  }

  function openMore() {

    if (mode !== 'edit' || !guest) return;
    Alert.alert(guest.full_name, undefined, [
      {
        text: 'View details',
        onPress: () => router.push(`/(app)/weddings/${weddingId}/guests/${guest.id}` as Href),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const tagChips: { id: string; label: string; active: boolean; onPress: () => void }[] = [
    ...GUEST_TYPES.map((value) => ({
      id: `type-${value}`,
      label: `+ ${guestTypeLabel(value)}`,
      active: guestType === value,
      onPress: () => setGuestType(guestType === value ? '' : value),
    })),
    ...GUEST_SIDES.map((value) => ({
      id: `side-${value}`,
      label: `+ ${sideLabel(value)}`,
      active: side === value,
      onPress: () => setSide(side === value ? '' : value),
    })),
  ];

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.success} />
        </Pressable>
        {mode === 'edit' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More options"
            hitSlop={12}
            onPress={openMore}
            style={styles.backBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.heading} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <View style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: avatarTone.bg }]}>
          <AppText variant="title" style={{ color: avatarTone.fg }}>
            {guestInitials(displayName)}
          </AppText>
        </View>
        <View style={styles.profileText}>
          <View style={styles.nameRow}>
            <AppText variant="subtitle" color="heading" numberOfLines={2} style={styles.profileName}>
              {displayName}
            </AppText>
            {rsvp ? <GuestStatusBadge rsvp={rsvp} /> : null}
          </View>
          <AppText variant="caption" color="textMuted">
            {title}
          </AppText>
        </View>
      </View>

      <Card style={styles.card}>
        <TextField
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors.fullName}
          editable={!submitting}
          autoCapitalize="words"
        />

        <View style={styles.fieldRow}>
          <AppText variant="label">Total Guests</AppText>
          <GuestCountStepper
            value={partySize}
            onChange={setPartySize}
            disabled={submitting}
          />
        </View>
        <AppText variant="caption" color="textMuted">
          1 = guest only · 2 = guest + plus one
        </AppText>

        <AppText variant="label">Category</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Not set" selected={!guestType} onPress={() => setGuestType('')} disabled={submitting} />
          {GUEST_TYPES.map((value) => (
            <Chip
              key={value}
              label={guestTypeLabel(value)}
              selected={guestType === value}
              onPress={() => setGuestType(value)}
              disabled={submitting}
            />
          ))}
        </ScrollView>

        <AppText variant="label">Table Assignment</AppText>
        {events.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            Add a wedding event first, then create tables on the Seating screen.
          </AppText>
        ) : (
          <>
            {events.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {events.map((event) => (
                  <Chip
                    key={event.id}
                    label={event.name}
                    selected={activeSeatingEventId === event.id}
                    onPress={() => {
                      setSeatingEventId(event.id);
                      setPendingTableId(undefined);
                    }}
                    tone="success"
                    disabled={submitting}
                  />
                ))}
              </ScrollView>
            ) : null}
            {tablesQuery.isPending || assignmentsQuery.isPending ? (
              <AppText variant="caption" color="textMuted">
                Loading tables...
              </AppText>
            ) : tables.length === 0 ? (
              <AppText variant="caption" color="textMuted">
                No tables yet for this event. Create them on the Seating screen.
              </AppText>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip
                  label="Unassigned"
                  selected={assignedTableId === null}
                  onPress={() => setPendingTableId(null)}
                  disabled={submitting}
                />
                {tables.map((table) => (
                  <Chip
                    key={table.id}
                    label={table.name}
                    selected={assignedTableId === table.id}
                    onPress={() => setPendingTableId(table.id)}
                    disabled={submitting}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        <AppText variant="label">Group</AppText>
        {groupsQuery.isPending ? (
          <AppText variant="caption" color="textMuted">
            Loading groups...
          </AppText>
        ) : groups.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No groups yet. Create groups from the Guests screen to organise families and friends.
          </AppText>
        ) : (
          <GroupChipList
            groups={groups}
            selectedId={groupId}
            onSelect={setGroupId}
            allLabel="No group"
            disabled={submitting}
          />
        )}

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          helperText="Optional"
          error={fieldErrors.notes}
          editable={!submitting}
          multiline
          style={styles.multiline}
        />

        <AppText variant="label">Tags</AppText>
        <View style={styles.chips}>
          {tagChips.map((tag) => (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityState={{ selected: tag.active }}
              disabled={submitting}
              onPress={tag.onPress}
              style={[styles.tag, tag.active && styles.tagActive]}>
              <AppText
                variant="caption"
                style={{ color: tag.active ? colors.heading : colors.textMuted, fontWeight: '600' }}>
                {tag.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          helperText="Optional"
          error={fieldErrors.phone}
          editable={!submitting}
          keyboardType="phone-pad"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          helperText="Optional"
          error={fieldErrors.email}
          editable={!submitting}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextField
          label="Dietary notes"
          value={dietaryNotes}
          onChangeText={setDietaryNotes}
          helperText="Optional"
          error={fieldErrors.dietaryNotes}
          editable={!submitting}
          multiline
          style={styles.multiline}
        />
      </Card>

      <View style={styles.actions}>
        <AuthFormError message={formError} />
        <Button
          label={mode === 'create' ? 'Add guest' : 'Save'}
          variant={mode === 'edit' ? 'success' : 'primary'}
          loading={save.isPending || assign.isPending || unassign.isPending}
          onPress={onSubmit}
        />
        {mode === 'edit' ? (
          <Button
            label="Remove Guest"
            variant="danger"
            loading={removeGuest.isPending}
            disabled={save.isPending}
            onPress={onRemove}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  profileName: {
    flexShrink: 1,
  },
  card: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  center: {
    textAlign: 'center',
  },
  });
}
