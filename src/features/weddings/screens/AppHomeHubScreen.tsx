import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { useMyWeddings } from '@/features/weddings/hooks/useMyWeddings';
import { OnboardingWelcomeScreen } from '@/features/weddings/screens/OnboardingWelcomeScreen';
import { spacing } from '@/theme/spacing';

/**
 * Authenticated entry: onboarding (0), dashboard (1), or selector (many).
 */
export function AppHomeHubScreen() {
  const router = useRouter();
  const { memberships, isLoading, error, refresh } = useMyWeddings();
  const singleId = memberships.length === 1 ? memberships[0]?.wedding_id : null;

  useEffect(() => {
    if (isLoading || error || !singleId) return;
    router.replace(`/(app)/weddings/${singleId}` as Href);
  }, [isLoading, error, singleId, router]);

  if (isLoading || (singleId && !error)) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.center}>
          <AppText variant="title" style={styles.title}>
            {"Couldn't load weddings"}
          </AppText>
          <AppText variant="body" color="textMuted" style={styles.copy}>
            {error.message}
          </AppText>
          <Button label="Retry" onPress={refresh} />
        </View>
      </Screen>
    );
  }

  if (memberships.length === 0) {
    return <OnboardingWelcomeScreen />;
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <AppText variant="title" style={styles.title}>
          Choose a wedding
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.copy}>
          You belong to {memberships.length} weddings.
        </AppText>
        <Button label="View weddings" onPress={() => router.push('/(app)/weddings' as Href)} />
        <Button
          label="Create another"
          variant="secondary"
          onPress={() => router.push('/(app)/create-wedding' as Href)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  copy: {
    textAlign: 'center',
  },
});
