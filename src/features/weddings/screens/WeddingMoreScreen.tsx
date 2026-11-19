import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useWeddingAccess } from '@/features/team/queries';
import { getCelebrationCopy } from '@/features/weddings/celebrationCopy';
import { useWedding } from '@/features/weddings/queries';
import { spacing } from '@/theme/spacing';

export function WeddingMoreScreen() {

  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const { signOut } = useAuth();
  const wedding = useWedding(weddingId);
  const { isOwner, can } = useWeddingAccess(weddingId);
  const copy = getCelebrationCopy(wedding.data?.celebration_kind);
  const insets = useSafeAreaInsets();
  const canSeeTeam = isOwner || can('team.view');
  const canSeeBudget = isOwner || can('budget.view');
  const canSeeDocuments = isOwner || can('documents.view');
  const canSeeTimeline = isOwner || can('timeline.view');

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen scroll contentStyle={{ paddingBottom: weddingTabBarInset(insets.bottom) }}>
        <StatusBar style="dark" />
        <Header title="More" subtitle={wedding.data?.title} />
        <View style={styles.stack}>
          {canSeeTeam ? (
            <Card style={styles.card}>
              <AppText variant="label">Planning team</AppText>
              <AppText variant="caption" color="textMuted">
                {isOwner
                  ? 'Invite collaborators, manage permissions, and see who is helping plan.'
                  : 'See who is helping plan this celebration.'}
              </AppText>
              <Button
                label="Planning team"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/team` as Href)}
              />
            </Card>
          ) : null}
          <Card style={styles.card}>
            <AppText variant="label">Planning</AppText>
            {copy.capabilities.budget && canSeeBudget ? (
              <Button
                label="Budget"
                variant="secondary"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/budget` as Href)}
              />
            ) : null}
            {copy.capabilities.timeline && canSeeTimeline ? (
              <Button
                label="Timeline & calendar"
                variant="secondary"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/timeline` as Href)}
              />
            ) : null}
            {copy.capabilities.documents && canSeeDocuments ? (
              <Button
                label="Documents"
                variant="secondary"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/documents` as Href)}
              />
            ) : null}
          </Card>
          <Card style={styles.card}>
            <AppText variant="label">Account</AppText>
            <Button
              label="Settings & profile"
              variant="secondary"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/settings` as Href)}
            />
            <Button
              label={copy.kind === 'wedding' ? 'Switch wedding' : 'Switch celebration'}
              variant="outline"
              onPress={() => router.push('/(app)/weddings' as Href)}
            />
            <Button
              label="Sign out"
              variant="danger"
              onPress={() => {
                void signOut().then((result) => {
                  if (result.ok) router.replace('/login');
                });
              }}
            />
          </Card>
        </View>
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stack: {
    gap: spacing.xl,
  },
  card: {
    gap: spacing.md,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
