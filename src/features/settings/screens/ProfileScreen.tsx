import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useMyProfile, useUpdateMyProfile, useUploadAvatar } from '@/features/settings/queries';
import type { Profile } from '@/features/settings/types';
import {
  fieldErrorsFromZod,
  profileFormSchema,
} from '@/features/settings/validation/profileSchemas';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function ProfileScreen() {

  const router = useRouter();
  const { user } = useAuth();
  const profileQuery = useMyProfile();

  if (profileQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Profile" showBack onBack={() => router.back()} />
        <FormSkeleton fields={4} />
      </Screen>
    );
  }

  if (!profileQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Profile" showBack onBack={() => router.back()} />
        <AppText color="danger">{errorMessage(profileQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void profileQuery.refetch()} />
      </Screen>
    );
  }

  return (
    <ProfileForm
      key={`${profileQuery.data.id}-${profileQuery.data.updated_at}`}
      profile={profileQuery.data}
      email={user?.email ?? ''}
      onBack={() => router.back()}
    />
  );
}

function ProfileForm({
  profile,
  email,
  onBack,
}: {
  profile: Profile;
  email: string;
  onBack: () => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const update = useUpdateMyProfile();
  const avatarUpload = useUploadAvatar();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onPickAvatar() {
    setFormError(null);
    setSuccess(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError('Photo library permission is required to update your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    avatarUpload.mutate(
      { uri: asset.uri, mimeType: asset.mimeType },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => setSuccess('Profile photo updated.'),
      },
    );
  }

  function onSave() {

    setFormError(null);
    setSuccess(null);
    const parsed = profileFormSchema.safeParse({ displayName, phone });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    update.mutate(
      {
        displayName: parsed.data.displayName,
        phone: parsed.data.phone || null,
        avatarUrl: profile.avatar_url,
      },
      {
        onError: (error) => setFormError(errorMessage(error)),
        onSuccess: () => setSuccess('Profile saved.'),
      },
    );
  }

  const avatar = profile.avatar_url;

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header title="Profile" showBack onBack={onBack} />
      <View style={styles.stack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={() => void onPickAvatar()}
          style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={36} color={colors.primary} />
            </View>
          )}
          <AppText variant="caption" color="primary" style={styles.changePhoto}>
            {avatarUpload.isPending ? 'Uploading…' : 'Change photo'}
          </AppText>
        </Pressable>

        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          error={fieldErrors.displayName}
          editable={!update.isPending}
        />
        <TextField
          label="Email"
          value={email}
          editable={false}
          helperText="Email is managed through your account sign-in."
        />
        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="Optional"
          error={fieldErrors.phone}
          editable={!update.isPending}
        />

        {formError ? <AppText color="danger">{formError}</AppText> : null}
        {success ? <AppText color="success">{success}</AppText> : null}

        <Button label="Save changes" loading={update.isPending} onPress={onSave} />
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  avatarWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceMuted,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  changePhoto: {
    fontWeight: '600',
  },
  });
}
