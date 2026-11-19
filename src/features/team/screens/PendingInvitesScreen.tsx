import * as Linking from 'expo-linking';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { InviteStatusBadge } from '@/features/team/components/InviteStatusBadge';
import {
  useResendTeamInvite,
  useRevokeTeamInvite,
  useTeamInvites,
  useWeddingAccess,
} from '@/features/team/queries';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PendingInvitesScreen() {
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/team`);
  const { isOwner, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const invitesQuery = useTeamInvites(isOwner ? weddingId : undefined);
  const resend = useResendTeamInvite(weddingId);
  const revoke = useRevokeTeamInvite(weddingId);
  const [actionError, setActionError] = useState<string | null>(null);

  const header = <Header title="Team invites" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (accessLoading || (isOwner && invitesQuery.isPending)) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={2} />
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
          description="Only wedding owners can manage team invitations."
        />
      </Screen>
    );
  }

  if (invitesQuery.isError && !invitesQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(invitesQuery.error)}
          </AppText>
          <Button label="Retry" loading={invitesQuery.isFetching} onPress={() => void invitesQuery.refetch()} />
        </View>
      </Screen>
    );
  }

  const invites = invitesQuery.data ?? [];

  async function onResend(inviteId: string) {
    setActionError(null);
    try {
      const created = await resend.mutateAsync(inviteId);
      const link = Linking.createURL(`/join/${created.rawToken}`);
      await Share.share({ message: `Join the planning team: ${link}` });
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  function onRevoke(inviteId: string, email: string) {
    Alert.alert('Revoke invite?', `${email} will no longer be able to join with this link.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          setActionError(null);
          revoke.mutate(inviteId, {
            onError: (error) => setActionError(errorMessage(error)),
          });
        },
      },
    ]);
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={invitesQuery.isRefetchError ? invitesQuery.error : null}
        onRetry={() => void invitesQuery.refetch()}
      />

      <View style={styles.stack}>
        <AuthFormError message={actionError} />
        {invites.length === 0 ? (
          <EmptyState
            icon="mail-outline"
            title="No invites yet"
            description="When you invite someone, their invite status will show up here."
          />
        ) : (
          invites.map((invite) => (
            <Card key={invite.id} style={styles.card}>
              <View style={styles.rowHeader}>
                <AppText variant="bodyMedium" style={styles.email}>
                  {invite.invited_email}
                </AppText>
                <InviteStatusBadge status={invite.status} />
              </View>
              <AppText variant="caption" color="textMuted">
                {invite.invite_kind === 'co_owner'
                  ? 'Co-owner'
                  : formatMemberRoleLabel(invite.role)}
                {invite.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : ''}
              </AppText>
              {invite.status === 'pending' ? (
                <View style={styles.rowActions}>
                  <Button
                    label="Resend & share"
                    variant="secondary"
                    fullWidth={false}
                    style={styles.small}
                    loading={resend.isPending && resend.variables === invite.id}
                    onPress={() => void onResend(invite.id)}
                  />
                  <Button
                    label="Revoke"
                    variant="danger"
                    fullWidth={false}
                    style={styles.small}
                    loading={revoke.isPending && revoke.variables === invite.id}
                    onPress={() => onRevoke(invite.id, invite.invited_email)}
                  />
                </View>
              ) : null}
            </Card>
          ))
        )}
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
  email: {
    flex: 1,
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
  center: {
    textAlign: 'center',
  },
});
