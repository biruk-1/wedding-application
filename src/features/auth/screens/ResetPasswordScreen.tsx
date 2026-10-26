import { useRouter, type Href } from 'expo-router';

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  fieldErrorsFromZod,
  resetPasswordSchema,
} from '@/features/auth/validation/authSchemas';
import { spacing } from '@/theme/spacing';

export function ResetPasswordScreen() {
  const router = useRouter();
  const { session, isPasswordRecovery, updatePassword, clearPasswordRecovery, isLoading } =
    useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canReset = Boolean(session) && isPasswordRecovery;


  async function onSubmit() {
    setFormError(null);
    if (!session) {
      setFormError('This reset link is invalid or expired. Request a new one.');
      return;
    }
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const result = await updatePassword(parsed.data.password);
    setLoading(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    clearPasswordRecovery();
    router.replace('/(app)' as Href);
  }


  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText variant="body" color="textMuted" style={styles.center}>
          Checking reset link…
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title="Set new password"
        subtitle={
          canReset
            ? 'Choose a new password for your Kiburan account'
            : 'Open the link from your email to continue'
        }
        showBack
        onBack={() => router.replace('/login')}
      />
      <View style={styles.form}>
        {!canReset ? (
          <>
            <AppText variant="body" color="textMuted" style={styles.center}>
              This password-reset link is invalid or has expired. Request a new link from the
              sign-in screen.
            </AppText>
            <Button label="Forgot password" onPress={() => router.replace('/forgot-password')} />
            <Button
              label="Back to sign in"
              variant="secondary"
              onPress={() => router.replace('/login')}
            />
          </>
        ) : (
          <>
            <PasswordField
              label="New password"
              placeholder="Create a password"
              autoComplete="new-password"
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              helperText="At least 6 characters"
              editable={!loading}
            />
            <PasswordField
              label="Confirm password"
              placeholder="Repeat password"
              autoComplete="new-password"
              textContentType="newPassword"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={fieldErrors.confirmPassword}
              editable={!loading}
            />
            <AuthFormError message={formError} />
            <Button label="Update password" loading={loading} onPress={() => void onSubmit()} />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
});
