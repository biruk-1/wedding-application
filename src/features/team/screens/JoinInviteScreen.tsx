import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAcceptTeamInvite, useTeamInvitePreview } from '@/features/team/queries';
import {
  clearPendingTeamInvite,
  savePendingTeamInvite,
} from '@/features/team/services/pendingTeamInvite';
import { validateTeamInviteEmail } from '@/features/team/services/teamService';
import { formatMemberRoleLabel } from '@/features/team/utils/roleLabels';
import { QueryError, errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

type Step = 'preview' | 'email' | 'otp' | 'accepting';

const RESEND_SECONDS = 45;

/**
 * Planning Team join link. Separate from guest RSVP (`/invite/[token]`).
 * Passwordless email OTP for invitees; password login remains available elsewhere.
 */
export function JoinInviteScreen() {
  const router = useRouter();
  const { token: routeToken } = useLocalSearchParams<{ token: string }>();
  const token = typeof routeToken === 'string' ? routeToken : routeToken?.[0];
  const { session, user, requestEmailOtp, verifyEmailOtp, signOut } = useAuth();
  const previewQuery = useTeamInvitePreview(token);
  const accept = useAcceptTeamInvite();

  const [step, setStep] = useState<Step>('preview');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const acceptingRef = useRef(false);

  useEffect(() => {
    if (token) void savePendingTeamInvite(token);
  }, [token]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // Signed-in with matching flow: offer accept. Wrong account: prompt switch.
  useEffect(() => {
    if (!session || step === 'otp' || step === 'accepting') return;
    if (step === 'email') return;
    setStep('preview');
  }, [session, step]);

  async function onDismiss() {
    await clearPendingTeamInvite();
    router.replace((session ? '/(app)' : '/') as Href);
  }

  async function onAccept() {
    if (!token || accept.isPending || acceptingRef.current) return;
    acceptingRef.current = true;
    setStep('accepting');
    setActionError(null);
    try {
      const membership = await accept.mutateAsync(token);
      router.replace(`/(app)/weddings/${membership.weddingId}` as Href);
    } catch (error) {
      acceptingRef.current = false;
      setStep('preview');
      setActionError(errorMessage(error));
    }
  }

  async function onContinueEmail() {
    if (!token || busy) return;
    setActionError(null);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setActionError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const validated = await validateTeamInviteEmail(token, trimmed);
      if (!validated.ok) {
        setActionError(validated.error.message);
        return;
      }
      const otpResult = await requestEmailOtp(trimmed);
      if (!otpResult.ok) {
        setActionError(otpResult.error.message);
        return;
      }
      setResendIn(RESEND_SECONDS);
      setStep('otp');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyOtp() {
    if (busy) return;
    setActionError(null);
    const code = otp.trim();
    if (code.length < 6) {
      setActionError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    try {
      const verified = await verifyEmailOtp({ email: email.trim(), token: code });
      if (!verified.ok) {
        setActionError(verified.error.message);
        return;
      }
      await onAccept();
    } finally {
      setBusy(false);
    }
  }

  async function onResendOtp() {
    if (busy || resendIn > 0) return;
    setActionError(null);
    setBusy(true);
    try {
      const otpResult = await requestEmailOtp(email.trim());
      if (!otpResult.ok) {
        setActionError(otpResult.error.message);
        return;
      }
      setResendIn(RESEND_SECONDS);
    } finally {
      setBusy(false);
    }
  }

  async function onSwitchAccount() {
    setActionError(null);
    await signOut();
    setStep('email');
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

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <View style={styles.stack}>
        <AppText variant="caption" color="textSubtle">
          Planning Team invite
        </AppText>
        <AppText variant="title">{"You've been invited to join a wedding planning team."}</AppText>
        <Card style={styles.card}>
          <AppText variant="subtitle">{preview.wedding_title}</AppText>
          <AppText variant="body">
            {preview.inviter_name} invited you to join as {roleLabel}.
          </AppText>
          {preview.invited_email_masked ? (
            <AppText variant="caption" color="textMuted">
              Invitation was sent to {preview.invited_email_masked}
            </AppText>
          ) : null}
        </Card>

        {actionError ? <AuthFormError message={actionError} /> : null}

        {step === 'accepting' ? (
          <AppText variant="body" color="textMuted">
            Joining the wedding…
          </AppText>
        ) : null}

        {signedIn && step !== 'otp' && step !== 'accepting' ? (
          <>
            <AppText variant="caption" color="textMuted">
              Signed in as {user?.email ?? 'your account'}
            </AppText>
            <Button
              label={preview.invite_kind === 'co_owner' ? 'Become an owner' : 'Join wedding'}
              onPress={() => void onAccept()}
              loading={accept.isPending}
            />
            <Button
              label="Use a different email"
              variant="secondary"
              onPress={() => void onSwitchAccount()}
            />
          </>
        ) : null}

        {!signedIn && step === 'preview' ? (
          <>
            <AppText variant="body" color="textMuted">
              Enter the email address that received this invitation. We will send a verification
              code so you can join securely — no password required.
            </AppText>
            <Button label="Continue" onPress={() => setStep('email')} />
            <Button
              label="I already use password login"
              variant="ghost"
              onPress={() =>
                router.push({
                  pathname: '/login',
                  params: preview.invited_email_masked
                    ? { emailHint: preview.invited_email_masked }
                    : undefined,
                } as Href)
              }
            />
          </>
        ) : null}

        {!signedIn && step === 'email' ? (
          <>
            <AppText variant="body" color="textMuted">
              Enter the email address that received this invitation. We will send you a verification
              code so you can securely join the team.
            </AppText>
            <TextField
              label="Email address"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <Button label="Send verification code" loading={busy} onPress={() => void onContinueEmail()} />
            <Button label="Back" variant="ghost" onPress={() => setStep('preview')} />
          </>
        ) : null}

        {!signedIn && step === 'otp' ? (
          <>
            <AppText variant="body" color="textMuted">
              Enter the 6-digit code we sent to {email}.
            </AppText>
            <TextField
              label="Verification code"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              value={otp}
              onChangeText={setOtp}
              editable={!busy}
            />
            <Button label="Verify & join" loading={busy} onPress={() => void onVerifyOtp()} />
            <Button
              label={resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
              variant="secondary"
              disabled={resendIn > 0 || busy}
              onPress={() => void onResendOtp()}
            />
            <Button
              label="Change email"
              variant="ghost"
              onPress={() => {
                setOtp('');
                setStep('email');
              }}
            />
          </>
        ) : null}

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
    paddingBottom: spacing['2xl'],
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
