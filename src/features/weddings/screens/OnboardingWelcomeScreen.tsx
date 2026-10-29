import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

const HERO = require('../../../../assets/images/style-blend.jpg');

export function OnboardingWelcomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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
          Plan your wedding together and discover trusted vendors — starting with one shared space
          for your celebration.
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
          accessibilityHint="Create your wedding"
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


const styles = StyleSheet.create({
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
