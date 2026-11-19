import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { ActivityRow } from '@/features/team/components/ActivityRow';
import { useTeamActivity, useWeddingAccess } from '@/features/team/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function ActivityScreen() {
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/team`);
  const { isOwner, can, isLoading: accessLoading } = useWeddingAccess(weddingId);
  const canView = isOwner || can('activity.view');
  const activityQuery = useTeamActivity(canView ? weddingId : undefined);

  const header = <Header title="Activity" showBack onBack={goBack} />;

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (accessLoading || (canView && activityQuery.isPending)) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={4} />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <EmptyState
          icon="time-outline"
          title="Activity not available"
          description="You need activity permission to see this history."
        />
      </Screen>
    );
  }

  if (activityQuery.isError && !activityQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.stack}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(activityQuery.error)}
          </AppText>
          <Button
            label="Retry"
            loading={activityQuery.isFetching}
            onPress={() => void activityQuery.refetch()}
          />
        </View>
      </Screen>
    );
  }

  const items = activityQuery.data ?? [];

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={activityQuery.isRefetchError ? activityQuery.error : null}
        onRetry={() => void activityQuery.refetch()}
      />

      <View style={styles.stack}>
        {items.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No activity yet"
            description="Team and planning changes you can see will show up here."
          />
        ) : (
          <Card style={styles.card}>
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
});
