import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { InvitationTrackingSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { Chip } from '@/features/guests/components/Chip';
import {
  useCancelInvitation,
  useInvitations,
  useMarkInvitationSent,
  useWeddingEvents,
} from '@/features/guests/queries';
import type { InvitationFilter, InvitationListItem, InvitationStatus } from '@/features/guests/types';
import {
  filterInvitations,
  INVITATION_STATUSES,
  invitationStatusLabel,
  invitationStatusTone,
  summarizeInvitations,
} from '@/features/guests/utils/guestHelpers';
import { useWeddingRole } from '@/features/weddings/queries';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

const EMPTY: InvitationListItem[] = [];

function dateOf(value: string | null): string | null {
  return value ? formatWeddingDateLabel(value.slice(0, 10)) : null;
}

export function InvitationTrackingScreen() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);

  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests`);
  const { canWrite } = useWeddingRole(weddingId);

  const invitationsQuery = useInvitations(weddingId);
  const eventsQuery = useWeddingEvents(weddingId);
  const markSent = useMarkInvitationSent(weddingId ?? '');
  const cancel = useCancelInvitation(weddingId ?? '');

  const [filter, setFilter] = useState<InvitationFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  const invitations = invitationsQuery.data ?? EMPTY;
  const summary = useMemo(() => summarizeInvitations(invitations), [invitations]);
  const visible = useMemo(() => filterInvitations(invitations, filter), [invitations, filter]);
  const eventNames = useMemo(
    () => new Map((eventsQuery.data ?? []).map((event) => [event.id, event.name])),
    [eventsQuery.data],
  );

  const onMarkSent = useCallback(
    (invitationId: string) => {
      Alert.alert(
        'Mark as shared?',
        'Only do this if you have already given this guest their link yourself. Kiburan cannot confirm delivery.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark as shared',
            onPress: () => {
              setActionError(null);
              markSent.mutate(invitationId, { onError: (error) => setActionError(errorMessage(error)) });
            },
          },
        ],
      );
    },
    [markSent],
  );

  const onCancel = useCallback(
    (invitationId: string) => {
      Alert.alert('Cancel invitation?', 'The guest will no longer be able to open this link.', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel invitation',
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            cancel.mutate(invitationId, { onError: (error) => setActionError(errorMessage(error)) });
          },
        },
      ]);
    },
    [cancel],
  );

  const renderItem = useCallback(
    ({ item }: { item: InvitationListItem }) => {
      const recipient = item.guest?.full_name ?? (item.group ? `${item.group.name} (group)` : 'Removed recipient');
      const events = item.event_ids.map((id) => eventNames.get(id)).filter(Boolean) as string[];
      const sentOn = dateOf(item.sent_at);
      const openedOn = dateOf(item.opened_at);
      const canMarkSent = canWrite && (item.status === 'draft' || item.status === 'ready');
      const canCancel = canWrite && item.status !== 'cancelled';
      return (
        <Card style={styles.card}>
          <View style={styles.rowHeader}>
            <AppText variant="bodyMedium" style={styles.flex} numberOfLines={1}>
              {recipient}
            </AppText>
            <Badge label={invitationStatusLabel(item.status)} tone={invitationStatusTone(item.status)} />
          </View>
          {item.design ? (
            <AppText variant="caption" color="textMuted">
              Design: {item.design.name}
            </AppText>
          ) : null}
          {events.length > 0 ? (
            <AppText variant="caption" color="textMuted">
              Events: {events.join(', ')}
            </AppText>
          ) : null}
          <AppText variant="caption" color="textMuted">
            Created {dateOf(item.created_at) ?? ''}
            {sentOn ? ` - Shared ${sentOn}` : ''}
            {openedOn ? ` - Opened ${openedOn}` : ''}
          </AppText>
          {canMarkSent || canCancel ? (
            <View style={styles.rowActions}>
              {canMarkSent ? (
                <Button
                  label="Mark as shared"
                  variant="secondary"
                  fullWidth={false}
                  style={styles.small}
                  loading={markSent.isPending && markSent.variables === item.id}
                  onPress={() => onMarkSent(item.id)}
                />
              ) : null}
              {canCancel ? (
                <Button
                  label="Cancel"
                  variant="danger"
                  fullWidth={false}
                  style={styles.small}
                  loading={cancel.isPending && cancel.variables === item.id}
                  onPress={() => onCancel(item.id)}
                />
              ) : null}
            </View>
          ) : null}
        </Card>
      );
    },
    [canWrite, eventNames, markSent.isPending, markSent.variables, cancel.isPending, cancel.variables, onMarkSent, onCancel, styles],
  );

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = <Header title="Invitations" subtitle="Tracking" showBack onBack={goBack} />;

  if (invitationsQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <InvitationTrackingSkeleton />
      </Screen>
    );
  }

  if (invitationsQuery.isError && !invitationsQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(invitationsQuery.error)}
          </AppText>
          <Button
            label="Retry"
            loading={invitationsQuery.isFetching}
            onPress={() => void invitationsQuery.refetch()}
          />
        </View>
      </Screen>
    );
  }

  const summaryCells: { label: string; value: number; status?: InvitationStatus }[] = [
    { label: 'Total', value: summary.total },
    ...INVITATION_STATUSES.filter(
      (status) => summary[status] > 0 || status === 'ready' || status === 'sent' || status === 'opened',
    ).map((status) => ({ label: invitationStatusLabel(status), value: summary[status], status })),
  ];

  const listHeader = (
    <View>
      {header}
      <RefreshNotice
        error={invitationsQuery.isRefetchError ? invitationsQuery.error : null}
        onRetry={() => void invitationsQuery.refetch()}
      />
      <View style={styles.summary}>
        {summaryCells.map((cell) => (
          <View key={cell.label} style={styles.summaryCell}>
            <AppText variant="subtitle" style={styles.value}>
              {cell.value}
            </AppText>
            <AppText variant="caption" color="textMuted" style={styles.center}>
              {cell.label}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" color="textMuted" style={styles.note}>
        Status reflects the planner sharing the link and the guest opening it. Kiburan does not send SMS or
        email, so delivery is not tracked. Links are shown only when created; to resend, create a new invitation.
      </AppText>
      <View style={styles.chips}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        {INVITATION_STATUSES.map((status) => (
          <Chip
            key={status}
            label={invitationStatusLabel(status)}
            selected={filter === status}
            onPress={() => setFilter(status)}
          />
        ))}
      </View>
      {actionError ? (
        <AppText variant="caption" color="danger" style={styles.actionError}>
          {actionError}
        </AppText>
      ) : null}
    </View>
  );

  const emptyState =
    invitations.length === 0 ? (
      <EmptyState
        icon="mail-open-outline"
        title="No invitations yet"
        description="Create an invitation for a guest or group, then share its link."
        action={
          canWrite ? (
            <Button
              label="Invite guests"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/guests/invite` as Href)}
            />
          ) : null
        }
      />
    ) : (
      <AppText color="textMuted" style={[styles.center, styles.empty]}>
        No invitations with this status.
      </AppText>
    );

  return (
    <Screen padded={false}>
      <StatusBar style="dark" />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={invitationsQuery.isRefetching}
            onRefresh={() => void invitationsQuery.refetch()}
            tintColor={colors.success}
            colors={[colors.success]}
          />
        }
      />
    </Screen>
  );
}

function Separator() {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.separator} />;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  block: {
    gap: spacing.md,
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCell: {
    minWidth: 72,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
  note: {
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionError: {
    marginBottom: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  small: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  separator: {
    height: spacing.md,
  },
  empty: {
    gap: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
  });
}
