import { useRouter } from 'expo-router';
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
import {
  fieldErrorsFromZod,
  forgotPasswordSchema,
} from '@/features/auth/validation/authSchemas';
import { spacing } from '@/theme/spacing';

const CONFIRMATION =
  'If an account exists for that email, you will receive a password reset link shortly.';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const result = await requestPasswordReset(parsed.data.email);
    setLoading(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setSent(true);
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title="Forgot password"
        subtitle="We’ll email you a secure reset link"
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.form}>
        {sent ? (
          <AppText variant="body" color="success" style={styles.confirm}>
            {CONFIRMATION}
          </AppText>
        ) : (
          <>
            <TextField
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              editable={!loading}
            />
            <AuthFormError message={formError} />
            <Button label="Send reset link" loading={loading} onPress={() => void onSubmit()} />
          </>
        )}
        <Button
          label="Back to sign in"
          variant="secondary"
          onPress={() => router.replace('/login')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  confirm: {
    textAlign: 'center',
    lineHeight: 24,
  },
});
