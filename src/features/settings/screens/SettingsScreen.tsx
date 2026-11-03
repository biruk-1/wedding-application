import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { WeddingStylePicker } from '@/features/settings/components/WeddingStylePicker';
import { useMyProfile } from '@/features/settings/queries';
import { useWedding, useUserId, useWeddingRole } from '@/features/weddings/queries';
import { updateWedding } from '@/features/weddings/services/weddingService';
import { queryKeys } from '@/lib/query/queryKeys';
import { useColors } from '@/theme/WeddingThemeContext';
import type { AppColors, WeddingVisualStyle } from '@/theme/types';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import { normalizeWeddingStyle, weddingStyleLabel } from '@/theme/weddingStyle';

function SettingsRow({
  label,
  hint,
  onPress,
  icon,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const styles = useMemo(() => createRowStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.success} />
      </View>
      <View style={styles.rowBody}>
        <AppText variant="bodyMedium">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="textMuted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

export function SettingsScreen({ weddingId }: { weddingId?: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useUserId();
  const { user, signOut } = useAuth();
  const profileQuery = useMyProfile();
  const weddingQuery = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const [styleSaving, setStyleSaving] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  const weddingStyle = normalizeWeddingStyle(weddingQuery.data?.style);
  const [draftStyle, setDraftStyle] = useState<WeddingVisualStyle | null>(null);
  const selectedStyle = draftStyle ?? weddingStyle;

  const backHref = weddingId
    ? (`/(app)/weddings/${weddingId}/more` as Href)
    : ('/(app)' as Href);

  async function saveWeddingStyle(next: WeddingVisualStyle) {
    if (!weddingId || !canWrite) return;
    setDraftStyle(next);
    setStyleSaving(true);
    setStyleError(null);
    const result = await updateWedding(weddingId, { style: next });
    setStyleSaving(false);
    if (!result.ok) {
      setStyleError(result.error.message);
      setDraftStyle(null);
      return;
    }
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memberships(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wedding(userId, weddingId) });
    }
    setDraftStyle(null);
  }

  if (profileQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        <Header title="Settings" showBack onBack={() => router.replace(backHref)} />
        <FormSkeleton fields={3} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header title="Settings" showBack onBack={() => router.replace(backHref)} />
      <View style={styles.stack}>
        <Card style={styles.card}>
          <AppText variant="label" color="heading">
            Account
          </AppText>
          <SettingsRow
            icon="person-outline"
            label="Profile"
            hint={profileQuery.data?.display_name || user?.email || 'Manage your profile'}
            onPress={() =>
              router.push(
                (weddingId
                  ? `/(app)/weddings/${weddingId}/settings/profile`
                  : '/(app)/settings/profile') as Href,
              )
            }
          />
          <SettingsRow
            icon="lock-closed-outline"
            label="Change password"
            hint="Update your sign-in password"
            onPress={() =>
              router.push(
                (weddingId
                  ? `/(app)/weddings/${weddingId}/settings/password`
                  : '/(app)/settings/password') as Href,
              )
            }
          />
        </Card>

        {weddingId ? (
          <Card style={styles.card}>
            <AppText variant="label" color="heading">
              Wedding appearance
            </AppText>
            <AppText variant="body" color="textMuted">
              Your wedding style sets colors, accents, and subtle cultural details across Kiburan.
              Current: {weddingStyleLabel(selectedStyle)}.
            </AppText>
            <WeddingStylePicker
              value={selectedStyle}
              onChange={(next) => void saveWeddingStyle(next)}
              disabled={!canWrite || styleSaving}
            />
            {styleError ? (
              <AppText variant="caption" color="danger">
                {styleError}
              </AppText>
            ) : null}
            {!canWrite ? (
              <AppText variant="caption" color="textSubtle">
                Only editors and owners can change the wedding style.
              </AppText>
            ) : null}
          </Card>
        ) : (
          <Card style={styles.card}>
            <AppText variant="label" color="heading">
              Appearance
            </AppText>
            <AppText variant="body" color="textMuted">
              Open a wedding to choose Modern Ethiopian, Traditional Ethiopian, or Ethiopian Fusion
              themes. Light and dark mode switching is not offered yet.
            </AppText>
          </Card>
        )}

        <Card style={styles.card}>
          <AppText variant="label" color="heading">
            Notifications
          </AppText>
          <AppText variant="body" color="textMuted">
            In-app and push notifications are not available yet. The backend tables, device token
            storage, and Expo push delivery still need to be added. See docs/notifications-proposal.md.
          </AppText>
        </Card>

        <Card style={styles.card}>
          <AppText variant="label" color="heading">
            Language
          </AppText>
          <AppText variant="body" color="textMuted">
            Kiburan currently runs in English. Amharic will appear here once application translations
            are implemented (your profile already stores a preferred language for that future work).
          </AppText>
          <AppText variant="caption" color="textSubtle">
            Stored preference: {profileQuery.data?.preferred_language === 'am' ? 'Amharic' : 'English'}
          </AppText>
        </Card>

        <Card style={styles.card}>
          <AppText variant="label" color="heading">
            Privacy & security
          </AppText>
          <AppText variant="body" color="textMuted">
            Wedding documents are stored in a private bucket and shared only with wedding members
            through secure signed links. Account deletion is not available in the app until a full
            deletion workflow is reviewed with the product team.
          </AppText>
        </Card>

        <Button
          label="Sign out"
          variant="danger"
          onPress={() => {
            void signOut();
          }}
        />
      </View>
    </Screen>
  );
}

function createRowStyles(colors: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    pressed: {
      opacity: 0.85,
    },
    rowIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.successMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: {
      flex: 1,
      gap: spacing.xxs,
    },
  });
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    stack: {
      gap: spacing.xl,
      paddingBottom: spacing['2xl'],
    },
    card: {
      gap: spacing.md,
    },
  });
}
