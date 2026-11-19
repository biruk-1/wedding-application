import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useGuestGroups } from '@/features/guests/queries';
import { RoleTemplatePicker } from '@/features/team/components/RoleTemplatePicker';
import type { InviteRoleTemplate } from '@/features/team/permissionLabels';
import { INVITE_ROLE_TEMPLATES } from '@/features/team/permissionLabels';
import {
  useLeaveWedding,
  useMemberCoordinations,
  useRemoveMember,
  useSetMemberRoleTemplate,
  useTeamMembers,
  useWeddingAccess,
} from '@/features/team/queries';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import type { WeddingMemberRole } from '@/features/weddings/types';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

function isInviteTemplate(role: string): role is InviteRoleTemplate {
  return (INVITE_ROLE_TEMPLATES as readonly string[]).includes(role);
}

export function MemberDetailScreen() {
  const router = useRouter();
  const { weddingId, userId: memberUserId } = useLocalSearchParams<{
    weddingId: string;
    userId: string;
  }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/team`);
  const { isOwner, can, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const membersQuery = useTeamMembers(weddingId);
  const groupsQuery = useGuestGroups(weddingId);
  const coordinationsQuery = useMemberCoordinations(weddingId, memberUserId);
  const setRole = useSetMemberRoleTemplate(weddingId);
  const remove = useRemoveMember(weddingId);
  const leave = useLeaveWedding();
  const [actionError, setActionError] = useState<string | null>(null);

  const member = useMemo(
    () => (membersQuery.data ?? []).find((row) => row.user_id === memberUserId) ?? null,
    [membersQuery.data, memberUserId],
  );

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  const canView = isOwner || can('team.view');
  const header = (
    <Header title={member?.display_name ?? 'Member'} showBack onBack={goBack} />
  );

  if (!weddingId || !memberUserId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing member.</AppText>
      </Screen>
    );
  }

  if (accessLoading || membersQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={3} />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Team not available"
          description="You don't have permission to see this member."
        />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="person-outline"
          title="Member not found"
          description="They may have left this wedding."
        />
      </Screen>
    );
  }

  const templateValue: InviteRoleTemplate = isInviteTemplate(member.role)
    ? member.role
    : 'custom';

  function onChangeTemplate(template: InviteRoleTemplate) {
    if (!member || setRole.isPending) return;
    Alert.alert(
      'Change role template?',
      `This resets ${member.display_name}'s permissions to the ${formatMemberRoleLabel(template)} defaults.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: () => {
            setActionError(null);
            setRole.mutate(
              {
                memberUserId: member.user_id,
                template: template as WeddingMemberRole,
                resetPermissions: true,
              },
              { onError: (error) => setActionError(errorMessage(error)) },
            );
          },
        },
      ],
    );
  }

  function onRemove() {
    if (!member) return;
    Alert.alert(
      `Remove ${member.display_name}?`,
      'They lose access immediately. Assigned tasks and coordinator roles are cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            remove.mutate(member.user_id, {
              onError: (error) => setActionError(errorMessage(error)),
              onSuccess: () => router.back(),
            });
          },
        },
      ],
    );
  }

  function onLeave() {
    Alert.alert(
      'Leave this wedding?',
      'You will lose access until an owner invites you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            leave.mutate(weddingId!, {
              onError: (error) => setActionError(errorMessage(error)),
              onSuccess: () => router.replace('/(app)/weddings' as Href),
            });
          },
        },
      ],
    );
  }

  const coordinated = coordinationsQuery.data ?? [];

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}

      <View style={styles.stack}>
        <Card style={styles.card}>
          <View style={styles.rowHeader}>
            <AppText variant="subtitle">{member.display_name}</AppText>
            {member.is_owner ? <Badge label="Owner" tone="primary" /> : null}
          </View>
          <AppText variant="caption" color="textMuted">
            {formatMemberRoleLabel(member.role)}
            {member.is_self ? ' · You' : ''}
          </AppText>
        </Card>

        <Card style={styles.card}>
          <AppText variant="label">Groups this person manages</AppText>
          {coordinated.length === 0 ? (
            <AppText variant="caption" color="textMuted">
              No guest groups assigned.
            </AppText>
          ) : (
            coordinated.map((row) => (
              <AppText key={row.group_id} variant="body">
                {groupNameById.get(row.group_id) ?? 'Guest group'}
              </AppText>
            ))
          )}
          {isOwner && !member.is_owner ? (
            <AppText variant="caption" color="textMuted">
              Assign coordinators from Guest groups → Coordinators on a group.
            </AppText>
          ) : null}
        </Card>

        {isOwner && !member.is_owner && !member.is_self ? (
          <Card style={styles.card}>
            <AppText variant="label">Role template</AppText>
            <RoleTemplatePicker
              value={templateValue}
              onChange={onChangeTemplate}
              disabled={setRole.isPending}
            />
            <Button
              label="Edit permissions"
              variant="secondary"
              onPress={() =>
                router.push(
                  `/(app)/weddings/${weddingId}/team/${member.user_id}/permissions` as Href,
                )
              }
            />
            <Button
              label="Remove from team"
              variant="danger"
              loading={remove.isPending}
              onPress={onRemove}
            />
          </Card>
        ) : null}

        {member.is_self && !member.is_owner ? (
          <Button
            label="Leave this wedding"
            variant="danger"
            loading={leave.isPending}
            onPress={onLeave}
          />
        ) : null}

        {member.is_self && member.is_owner ? (
          <AppText variant="caption" color="textMuted">
            Owners leave only after inviting a co-owner, or by transferring ownership outside the app if needed.
          </AppText>
        ) : null}

        <AuthFormError message={actionError} />
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
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
