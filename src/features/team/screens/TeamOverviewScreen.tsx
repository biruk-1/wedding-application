import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { MemberRow } from '@/features/team/components/MemberRow';
import {
  useTeamInvites,
  useTeamMembers,
  useWeddingAccess,
} from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function TeamOverviewScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/more`);
  const { isOwner, can, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const membersQuery = useTeamMembers(weddingId);
  const invitesQuery = useTeamInvites(isOwner ? weddingId : undefined);

  const canView = isOwner || can('team.view');
  const pendingCount = useMemo(
    () => (invitesQuery.data ?? []).filter((invite) => invite.status === 'pending').length,
    [invitesQuery.data],
  );

  const members = useMemo(() => {
    const rows = [...(membersQuery.data ?? [])];
    rows.sort((a, b) => {
      if (a.is_owner !== b.is_owner) return a.is_owner ? -1 : 1;
      return a.display_name.localeCompare(b.display_name);
    });
    return rows;
  }, [membersQuery.data]);

  const header = <Header title="Planning team" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
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
          icon="people-outline"
          title="Team not available"
          description="You don't have permission to see the planning team for this wedding."
        />
      </Screen>
    );
  }

  if (membersQuery.isError && !membersQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(membersQuery.error)}
          </AppText>
          <Button label="Retry" loading={membersQuery.isFetching} onPress={() => void membersQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={membersQuery.isRefetchError ? membersQuery.error : null}
        onRetry={() => void membersQuery.refetch()}
      />

      <View style={styles.stack}>
        {isOwner ? (
          <Card style={styles.card}>
            <AppText variant="label">Invite & manage</AppText>
            <AppText variant="caption" color="textMuted">
              Owners invite collaborators, edit permissions, and assign guest-group coordinators.
            </AppText>
            <Button
              label="Invite member"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/team/invite` as Href)}
            />
            <Button
              label={pendingCount > 0 ? `Pending invites (${pendingCount})` : 'Pending invites'}
              variant="secondary"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/team/invitations` as Href)}
            />
          </Card>
        ) : null}

        {(isOwner || can('activity.view')) ? (
          <Button
            label="Activity"
            variant="outline"
            onPress={() => router.push(`/(app)/weddings/${weddingId}/team/activity` as Href)}
          />
        ) : null}

        <Card style={styles.card}>
          <AppText variant="label">Members</AppText>
          {members.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No members yet"
              description="Invite someone to help plan this celebration."
            />
          ) : (
            members.map((member) => (
              <MemberRow
                key={member.user_id}
                member={member}
                onPress={() =>
                  router.push(`/(app)/weddings/${weddingId}/team/${member.user_id}` as Href)
                }
              />
            ))
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
  center: {
    textAlign: 'center',
  },
});
