import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAcceptTeamInvite, useTeamInvitePreview } from '@/features/team/queries';
import {
  clearPendingTeamInvite,
  savePendingTeamInvite,
} from '@/features/team/services/pendingTeamInvite';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { QueryError, errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

/**
 * Planning Team join link. Separate from guest RSVP (`/invite/[token]`).
 * Works signed out for preview; accept requires the invited, confirmed account.
 */
export function JoinInviteScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token: string }>();
  const token = typeof routeToken === 'string' ? routeToken : routeToken?.[0];
  const { session, user } = useAuth();
  const previewQuery = useTeamInvitePreview(token);
  const accept = useAcceptTeamInvite();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (token) void savePendingTeamInvite(token);
  }, [token]);

  async function onAccept() {
    if (!token || accept.isPending) return;
    setActionError(null);
    try {
      const membership = await accept.mutateAsync(token);
      router.replace(`/(app)/weddings/${membership.weddingId}` as Href);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  async function onDismiss() {
    await clearPendingTeamInvite();
    router.replace((session ? '/(app)' : '/') as Href);
  }

  if (!token) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Message
          title="Invite link incomplete"
          body="This link is missing its invite code."
          onDismiss={onDismiss}
        />
      </Screen>
    );
  }

  if (previewQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <View style={styles.stack} accessibilityLabel="Loading invite">
          <Skeleton width="100%" height={180} radius={radii.xl} />
          <Skeleton width="70%" height={20} />
          <Skeleton width="100%" height={48} radius={radii.lg} />
        </View>
      </Screen>
    );
  }

  const preview = previewQuery.data;
  if (!preview) {
    const code = previewQuery.error instanceof QueryError ? previewQuery.error.code : 'unknown';
    const body =
      code === 'revoked'
        ? 'This invite was revoked by a wedding owner.'
        : code === 'expired'
          ? 'This invite has expired. Ask an owner for a new link.'
          : 'This invite link is not valid.';
    return (
      <Screen>
        <StatusBar style="dark" />
        <Message title="Invite unavailable" body={body} onDismiss={onDismiss} />
      </Screen>
    );
  }

  if (preview.status !== 'pending') {
    const body =
      preview.status === 'accepted'
        ? 'This invite has already been used.'
        : preview.status === 'revoked'
          ? 'This invite was revoked by a wedding owner.'
          : 'This invite has expired. Ask an owner for a new link.';
    return (
      <Screen>
        <StatusBar style="dark" />
        <Message title="Invite unavailable" body={body} onDismiss={onDismiss} />
      </Screen>
    );
  }

  const roleLabel =
    preview.invite_kind === 'co_owner' ? 'Owner' : formatMemberRoleLabel(preview.role);
  const signedIn = Boolean(session);
  const emailHint = preview.invited_email_masked
    ? `Sent to ${preview.invited_email_masked}`
    : null;

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <View style={styles.stack}>
        <AppText variant="caption" color="textSubtle">
          Planning Team invite
        </AppText>
        <AppText variant="title">{preview.wedding_title}</AppText>
        <Card style={styles.card}>
          <AppText variant="body">
            {preview.inviter_name} invited you to join as {roleLabel}.
          </AppText>
          {emailHint ? (
            <AppText variant="caption" color="textMuted">
              {emailHint}
            </AppText>
          ) : null}
        </Card>

        {actionError ? <AuthFormError message={actionError} /> : null}

        {signedIn ? (
          <>
            <AppText variant="caption" color="textMuted">
              Signed in as {user?.email ?? 'your account'}
            </AppText>
            <Button
              label={preview.invite_kind === 'co_owner' ? 'Become an owner' : 'Join wedding'}
              onPress={() => void onAccept()}
              loading={accept.isPending}
            />
          </>
        ) : (
          <>
            <Button
              label="Sign in to join"
              onPress={() =>
                router.push({
                  pathname: '/login',
                  params: preview.invited_email_masked
                    ? { emailHint: preview.invited_email_masked }
                    : undefined,
                } as Href)
              }
            />
            <Button
              label="Create account"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/register',
                  params: preview.invited_email_masked
                    ? { emailHint: preview.invited_email_masked }
                    : undefined,
                } as Href)
              }
            />
          </>
        )}
        <Button label="Not now" variant="ghost" onPress={() => void onDismiss()} />
      </View>
    </Screen>
  );
}

function Message({
  title,
  body,
  onDismiss,
}: {
  title: string;
  body: string;
  onDismiss: () => void;
}) {
  return (
    <View style={styles.message}>
      <AppText variant="subtitle">{title}</AppText>
      <AppText variant="body" color="textMuted" style={styles.center}>
        {body}
      </AppText>
      <Button label="Close" onPress={onDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  card: {
    gap: spacing.sm,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
});
