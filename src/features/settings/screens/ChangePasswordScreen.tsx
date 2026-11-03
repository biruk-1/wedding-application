import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  changePasswordSchema,
  fieldErrorsFromZod,
} from '@/features/settings/validation/profileSchemas';
import { spacing } from '@/theme/spacing';

export function ChangePasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {

    setFormError(null);
    setSuccess(false);
    const parsed = changePasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    const result = await updatePassword(parsed.data.password);
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }
    setPassword('');
    setConfirmPassword('');
    setSuccess(true);
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title="Change password" showBack onBack={() => router.back()} />
      <View style={styles.stack}>
        <AppText variant="body" color="textMuted">
          Choose a new password for your Kiburan account. You will stay signed in on this device.
        </AppText>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          error={fieldErrors.password}
          editable={!submitting}
        />
        <TextField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={fieldErrors.confirmPassword}
          editable={!submitting}
        />
        {formError ? <AppText color="danger">{formError}</AppText> : null}
        {success ? <AppText color="success">Password updated.</AppText> : null}
        <Button label="Update password" loading={submitting} onPress={() => void onSubmit()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
});
