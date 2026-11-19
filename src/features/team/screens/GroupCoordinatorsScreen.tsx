import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useGuestGroups } from '@/features/guests/queries';
import {
  useAssignGroupCoordinator,
  useGroupCoordinators,
  useTeamMembers,
  useUnassignGroupCoordinator,
  useWeddingAccess,
} from '@/features/team/queries';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function GroupCoordinatorsScreen() {
  const { weddingId, groupId } = useLocalSearchParams<{ weddingId: string; groupId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/guests/groups`);
  const { isOwner, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const groupsQuery = useGuestGroups(weddingId);
  const membersQuery = useTeamMembers(weddingId);
  const coordinatorsQuery = useGroupCoordinators(isOwner ? weddingId : undefined, groupId);
  const assign = useAssignGroupCoordinator(weddingId);
  const unassign = useUnassignGroupCoordinator(weddingId);
  const [actionError, setActionError] = useState<string | null>(null);

  const group = useMemo(
    () => (groupsQuery.data ?? []).find((row) => row.id === groupId) ?? null,
    [groupsQuery.data, groupId],
  );

  const coordinatorIds = useMemo(
    () => new Set((coordinatorsQuery.data ?? []).map((row) => row.user_id)),
    [coordinatorsQuery.data],
  );

  const candidates = useMemo(
    () => (membersQuery.data ?? []).filter((member) => !member.is_owner),
    [membersQuery.data],
  );

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of membersQuery.data ?? []) map.set(member.user_id, member.display_name);
    return map;
  }, [membersQuery.data]);

  const header = (
    <Header title={group?.name ? `${group.name} coordinators` : 'Coordinators'} showBack onBack={goBack} />
  );

  if (!weddingId || !groupId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing group.</AppText>
      </Screen>
    );
  }

  if (
    accessLoading ||
    groupsQuery.isPending ||
    membersQuery.isPending ||
    (isOwner && coordinatorsQuery.isPending)
  ) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={3} />
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Owners only"
          description="Only wedding owners can assign guest-group coordinators."
        />
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="people-circle-outline"
          title="Group not found"
          description="This guest group may have been deleted."
        />
      </Screen>
    );
  }

  function onAssign(memberUserId: string) {
    setActionError(null);
    assign.mutate(
      { groupId: groupId!, memberUserId, canSendInvitations: true },
      { onError: (error) => setActionError(errorMessage(error)) },
    );
  }

  function onUnassign(memberUserId: string) {
    setActionError(null);
    unassign.mutate(
      { groupId: groupId!, memberUserId },
      { onError: (error) => setActionError(errorMessage(error)) },
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}

      <View style={styles.stack}>
        <AppText variant="body" color="textMuted">
          Coordinators can manage guests in {group.name}. Owners keep full access either way.
        </AppText>

        <AuthFormError message={actionError} />

        <Card style={styles.card}>
          <AppText variant="label">Current coordinators</AppText>
          {(coordinatorsQuery.data ?? []).length === 0 ? (
            <AppText variant="caption" color="textMuted">
              None yet.
            </AppText>
          ) : (
            (coordinatorsQuery.data ?? []).map((row) => (
              <View key={row.user_id} style={styles.row}>
                <AppText variant="body" style={styles.flex}>
                  {nameById.get(row.user_id) ?? 'Member'}
                </AppText>
                <Button
                  label="Remove"
                  variant="danger"
                  fullWidth={false}
                  style={styles.small}
                  loading={
                    unassign.isPending &&
                    unassign.variables?.memberUserId === row.user_id &&
                    unassign.variables?.groupId === groupId
                  }
                  onPress={() => onUnassign(row.user_id)}
                />
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <AppText variant="label">Add coordinator</AppText>
          {candidates.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              Invite a collaborator first, then assign them here.
            </AppText>
          ) : (
            candidates.map((member) => {
              const already = coordinatorIds.has(member.user_id);
              return (
                <View key={member.user_id} style={styles.row}>
                  <View style={styles.flex}>
                    <AppText variant="body">{member.display_name}</AppText>
                    <AppText variant="caption" color="textMuted">
                      {formatMemberRoleLabel(member.role)}
                    </AppText>
                  </View>
                  <Button
                    label={already ? 'Assigned' : 'Assign'}
                    variant={already ? 'secondary' : 'primary'}
                    fullWidth={false}
                    style={styles.small}
                    disabled={already}
                    loading={
                      assign.isPending &&
                      assign.variables?.memberUserId === member.user_id &&
                      assign.variables?.groupId === groupId
                    }
                    onPress={() => onAssign(member.user_id)}
                  />
                </View>
              );
            })
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  small: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
});
