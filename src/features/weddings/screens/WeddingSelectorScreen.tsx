import { useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { normalizeCelebrationKind } from '@/features/weddings/celebrationCopy';
import { WeddingListCard } from '@/features/weddings/components/WeddingListCard';
import { useMyWeddings } from '@/features/weddings/hooks/useMyWeddings';
import { spacing } from '@/theme/spacing';

export function WeddingSelectorScreen() {
  const router = useRouter();
  const { memberships, isLoading, error, refresh } = useMyWeddings();
  const includesOtherCelebrations = memberships.some(
    ({ wedding }) => normalizeCelebrationKind(wedding.celebration_kind) !== 'wedding',
  );

  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      <Header
        title={includesOtherCelebrations ? 'Your celebrations' : 'Your weddings'}
        subtitle={
          includesOtherCelebrations
            ? 'Choose a celebration to continue planning'
            : 'Choose a wedding to continue planning'
        }
        showBack
        onBack={() => router.replace('/(app)' as Href)}
      />
      {error ? (
        <View style={styles.block}>
          <AppText variant="body" color="danger" style={styles.center}>
            {error.message}
          </AppText>
          <Button label="Retry" onPress={refresh} />
        </View>
      ) : null}
      <View style={styles.list}>
        {memberships.map((membership) => (
          <WeddingListCard
            key={membership.wedding_id}
            membership={membership}
            onPress={() => router.push(`/(app)/weddings/${membership.wedding_id}` as Href)}
          />
        ))}
      </View>
      <Button
        label={includesOtherCelebrations ? 'Create another celebration' : 'Create another wedding'}
        variant="secondary"
        onPress={() => router.push('/(app)/create-wedding' as Href)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  center: {
    textAlign: 'center',
  },
});
