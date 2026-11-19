import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { WeddingListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import {
  useAcceptMyTeamInvite,
  useMyPendingTeamInvites,
} from '@/features/team/queries';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { normalizeCelebrationKind } from '@/features/weddings/celebrationCopy';
import { WeddingListCard } from '@/features/weddings/components/WeddingListCard';
import { useMyWeddings } from '@/features/weddings/hooks/useMyWeddings';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function WeddingSelectorScreen() {
  const router = useRouter();
  const { memberships, isLoading, error, refresh } = useMyWeddings();
  const pendingQuery = useMyPendingTeamInvites();
  const acceptPending = useAcceptMyTeamInvite();
  const [actionError, setActionError] = useState<string | null>(null);
  const includesOtherCelebrations = memberships.some(
    ({ wedding }) => normalizeCelebrationKind(wedding.celebration_kind) !== 'wedding',
  );

  const pendingInvites = pendingQuery.data ?? [];

  async function onAcceptInvite(inviteId: string) {
    if (acceptPending.isPending) return;
    setActionError(null);
    try {
      const membership = await acceptPending.mutateAsync(inviteId);
      router.push(`/(app)/weddings/${membership.weddingId}` as Href);
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <WeddingListSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title={includesOtherCelebrations ? 'Your celebrations' : 'Your weddings'}
        subtitle={
          includesOtherCelebrations
            ? 'Choose a celebration to continue planning'
            : 'Choose a wedding to continue planning'
        }
        showBack
        onBack={() => router.replace('/(app)' as Href)}
      />
      {error ? (
        <View style={styles.block}>
          <AppText variant="body" color="danger" style={styles.center}>
            {error.message}
          </AppText>
          <Button label="Retry" onPress={refresh} />
        </View>
      ) : null}

      {pendingInvites.length > 0 ? (
        <View style={styles.pendingBlock}>
          <AppText variant="label">Pending team invites</AppText>
          <AppText variant="caption" color="textMuted">
            These were sent to your signed-in email. Join without needing the original link.
          </AppText>
          <AuthFormError message={actionError} />
          {pendingInvites.map((invite) => (
            <Card key={invite.id} style={styles.pendingCard}>
              <AppText variant="bodyMedium">{invite.wedding_title}</AppText>
              <AppText variant="caption" color="textMuted">
                {invite.inviter_name} invited you as{' '}
                {invite.invite_kind === 'co_owner'
                  ? 'Owner'
                  : formatMemberRoleLabel(invite.role)}
              </AppText>
              <Button
                label="Join"
                fullWidth={false}
                style={styles.joinButton}
                loading={acceptPending.isPending && acceptPending.variables === invite.id}
                onPress={() => void onAcceptInvite(invite.id)}
              />
            </Card>
          ))}
        </View>
      ) : null}

      <View style={styles.list}>
        {memberships.map((membership) => (
          <WeddingListCard
            key={membership.wedding_id}
            membership={membership}
            onPress={() => router.push(`/(app)/weddings/${membership.wedding_id}` as Href)}
          />
        ))}
      </View>
      <Button
        label={includesOtherCelebrations ? 'Create another celebration' : 'Create another wedding'}
        variant="secondary"
        onPress={() => router.push('/(app)/create-wedding' as Href)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  pendingBlock: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  pendingCard: {
    gap: spacing.sm,
  },
  joinButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
});
