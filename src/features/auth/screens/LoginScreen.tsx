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
  loginSchema,
} from '@/features/auth/validation/authSchemas';
import { spacing } from '@/theme/spacing';

export function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setLoading(true);
    const result = await signIn(parsed.data);
    setLoading(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    router.replace('/(app)' as Href);
  }


  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Welcome back" subtitle="Sign in to continue planning" showBack />
      <View style={styles.form}>
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
          placeholder="••••••••"
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          editable={!loading}
        />
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/forgot-password')}
          style={styles.forgot}>
          <AppText variant="label" color="success">
            Forgot password?
          </AppText>
        </Pressable>
        <AuthFormError message={formError} />
        <Button label="Sign in" loading={loading} onPress={() => void onSubmit()} />
        <Link href="/register" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
            <AppText variant="bodyMedium" color="success" style={styles.linkText}>
              Create an account
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
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
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
