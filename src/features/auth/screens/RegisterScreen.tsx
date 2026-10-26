import { Link, useRouter, type Href } from 'expo-router';

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { PasswordField } from '@/features/auth/components/PasswordField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  fieldErrorsFromZod,
  registerSchema,
} from '@/features/auth/validation/authSchemas';
import { spacing } from '@/theme/spacing';

export function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(null);
    setInfoMessage(null);
    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const result = await signUp(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    if (result.data.needsEmailConfirmation) {
      setInfoMessage(
        'Check your email to confirm your account before signing in. Your profile will be ready after confirmation.',
      );
      return;
    }
    router.replace('/(app)' as Href);
  }


  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Create account" subtitle="Join Kiburan to plan together" showBack />
      <View style={styles.form}>
        <TextField
          label="Full name"
          placeholder="Your name"
          autoComplete="name"
          textContentType="name"
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors.fullName}
          editable={!loading}
        />
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
        <PasswordField
          label="Password"
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
        {infoMessage ? (
          <AppText variant="caption" color="success" style={styles.info}>
            {infoMessage}
          </AppText>
        ) : null}
        <Button label="Create account" loading={loading} onPress={() => void onSubmit()} />
        <Link href="/login" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
            <AppText variant="bodyMedium" color="success" style={styles.linkText}>
              I already have an account
            </AppText>
          </Pressable>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  info: {
    textAlign: 'center',
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    textAlign: 'center',
  },
});
