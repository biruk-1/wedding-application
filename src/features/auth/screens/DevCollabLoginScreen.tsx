import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DEV_COLLAB_PASSWORD, isDevCollabLoginEnabled } from '@/lib/devFlags';
import { spacing } from '@/theme/spacing';

/**
 * TEMPORARY — local testing only. Remove when invite deep links / OTP are easy to use.
 * Signs in (or creates) an account for the typed email with a fixed dev password,
 * then opens Your weddings so Pending team invites can be accepted.
 */
export function DevCollabLoginScreen() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isDevCollabLoginEnabled()) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Not available" showBack onBack={() => router.back()} />
        <AppText color="textMuted">
          Dev collaborator login only works in development against a local Supabase.
        </AppText>
      </Screen>
    );
  }

  async function onSubmit() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Enter the invited collaborator email.');
      return;
    }

    setLoading(true);
    try {
      const existing = await signIn({ email: trimmed, password: DEV_COLLAB_PASSWORD });
      if (existing.ok) {
        router.replace('/(app)/weddings' as Href);
        return;
      }

      const created = await signUp({
        email: trimmed,
        password: DEV_COLLAB_PASSWORD,
        fullName: trimmed.split('@')[0] || 'Collaborator',
      });
      if (!created.ok) {
        setError(created.error.message);
        return;
      }
      if (created.data.needsEmailConfirmation) {
        setError('Confirm the email in Mailpit, then try again.');
        return;
      }
      if (!created.data.session) {
        const again = await signIn({ email: trimmed, password: DEV_COLLAB_PASSWORD });
        if (!again.ok) {
          setError(again.error.message);
          return;
        }
      }
      router.replace('/(app)/weddings' as Href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title="Dev collaborator login"
        subtitle="Temporary — remove before production"
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.stack}>
        <AppText variant="body" color="textMuted">
          Type the email the owner invited. This creates or signs in that account with a fixed local
          password (no OTP). Then open Pending team invites and tap Join.
        </AppText>
        <AppText variant="caption" color="warning">
          Dev only. Password for these test accounts: {DEV_COLLAB_PASSWORD}
        </AppText>
        <TextField
          label="Collaborator email"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          placeholder="collab@test.com"
        />
        <AuthFormError message={error} />
        <Button label="Sign in as collaborator" loading={loading} onPress={() => void onSubmit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
});
