import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

const HERO = require('../../../../assets/images/style-blend.jpg');

export function OnboardingWelcomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const styles = useThemedStyles(createStyles);

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <View style={styles.heroWrap}>
        <Image source={HERO} style={styles.hero} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={styles.copy}>
        <AppText variant="title" style={styles.title}>
          Welcome to Kiburan
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.body}>
          Plan an Ethiopian wedding, ceremony, or celebration and discover trusted vendors — all
          from one shared space.
        </AppText>
        {user?.email ? (
          <AppText variant="caption" color="textSubtle" style={styles.body}>
            Signed in as {user.email}
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button
          label="Start planning"
          onPress={() => router.push('/(app)/create-wedding' as Href)}
          accessibilityHint="Create your celebration"
        />
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => {
            void signOut().then((result) => {
              if (result.ok) router.replace('/');
            });
          }}
        />
      </View>
    </Screen>
  );
}


function createStyles(colors: AppColors) {
  return StyleSheet.create({
  heroWrap: {
    borderRadius: radii['2xl'],
    overflow: 'hidden',
    marginBottom: spacing.xl,
    backgroundColor: colors.surfaceMuted,
  },
  hero: {
    width: '100%',
    height: 200,
  },
  copy: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  title: {
    textAlign: 'center',
    color: colors.text,
  },
  body: {
    textAlign: 'center',
  },
  actions: {
    gap: spacing.lg,
  },
  });
}
