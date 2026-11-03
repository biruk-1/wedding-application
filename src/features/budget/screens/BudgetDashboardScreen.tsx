import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { BudgetDashboardSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { BudgetSummaryCard } from '@/features/budget/components/BudgetSummaryCard';
import { CategoryBreakdownList } from '@/features/budget/components/CategoryBreakdownList';
import { ExpenseRow } from '@/features/budget/components/ExpenseRow';
import { useBudgetDashboard } from '@/features/budget/queries';
import { formatMoney } from '@/features/budget/utils/money';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';

export function BudgetDashboardScreen() {

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/more`);
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const dashboard = useBudgetDashboard(weddingId);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <Header title="Budget" subtitle={wedding.data?.title} showBack onBack={goBack} />
  );

  if (dashboard.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <BudgetDashboardSkeleton />
      </Screen>
    );
  }

  if (dashboard.isError && !dashboard.budget) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(dashboard.error)}
          </AppText>
          <Button label="Retry" onPress={dashboard.refetch} />
        </View>
      </Screen>
    );
  }

  const recent = dashboard.items.slice(0, 5);
  const currency = dashboard.summary.currencyCode;

  return (
    <View style={styles.root}>
      <Screen scroll contentStyle={{ paddingBottom: tabInset }}>
        <StatusBar style="dark" />
        {header}
        <RefreshNotice
          error={dashboard.isRefetchError ? dashboard.error : null}
          onRetry={dashboard.refetch}
        />

        <View style={styles.stack}>
          <BudgetSummaryCard summary={dashboard.summary} />

          {dashboard.summary.outstanding > 0 ? (
            <Card style={styles.callout}>
              <AppText variant="label">Outstanding</AppText>
              <AppText variant="body" color="textMuted">
                {formatMoney(dashboard.summary.outstanding, currency)} still due across expenses.
              </AppText>
            </Card>
          ) : null}

          <CategoryBreakdownList
            rows={dashboard.categories}
            currencyCode={currency}
            onPressCategory={(categoryId) =>
              router.push(
                `/(app)/weddings/${weddingId}/budget/expenses${categoryId ? `?categoryId=${categoryId}` : ''}` as Href,
              )
            }
          />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="label">Recent expenses</AppText>
              <Button
                label="See all"
                variant="secondary"
                onPress={() => router.push(`/(app)/weddings/${weddingId}/budget/expenses` as Href)}
              />
            </View>
            {recent.length === 0 ? (
              <Card>
                <AppText variant="body" color="textMuted">
                  No expenses yet. Add your first planned or committed cost.
                </AppText>
              </Card>
            ) : (
              <View style={styles.list}>
                {recent.map((item) => (
                  <ExpenseRow
                    key={item.id}
                    item={item}
                    currencyCode={currency}
                    onOpen={(id) =>
                      router.push(`/(app)/weddings/${weddingId}/budget/expenses/${id}` as Href)
                    }
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {canWrite ? (
              <>
                <Button
                  label="Add expense"
                  onPress={() =>
                    router.push(`/(app)/weddings/${weddingId}/budget/expenses/new` as Href)
                  }
                />
                <Button
                  label="Edit total budget"
                  variant="secondary"
                  onPress={() => router.push(`/(app)/weddings/${weddingId}/budget/edit` as Href)}
                />
              </>
            ) : null}
            <Button
              label="Categories"
              variant="secondary"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/budget/categories` as Href)}
            />
          </View>
        </View>
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  stack: {
    gap: spacing.xl,
    paddingBottom: spacing.lg,
  },
  block: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
  callout: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
});
