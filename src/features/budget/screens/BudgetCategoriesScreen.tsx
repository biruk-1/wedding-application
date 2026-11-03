import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { BudgetDashboardSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { useBudgetCategories, useBudgetDashboard } from '@/features/budget/queries';
import { formatMoney } from '@/features/budget/utils/money';
import { useWedding } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function BudgetCategoriesScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/budget`);
  const wedding = useWedding(weddingId);
  const categoriesQuery = useBudgetCategories();
  const dashboard = useBudgetDashboard(weddingId);

  const byId = useMemo(() => {
    const map = new Map(dashboard.categories.map((row) => [row.categoryId, row]));
    return map;
  }, [dashboard.categories]);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <Header title="Budget categories" subtitle={wedding.data?.title} showBack onBack={goBack} />
  );

  if (categoriesQuery.isPending || dashboard.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <BudgetDashboardSkeleton />
      </Screen>
    );
  }

  if (categoriesQuery.isError && !categoriesQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <AppText color="danger">{errorMessage(categoriesQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void categoriesQuery.refetch()} />
      </Screen>
    );
  }

  const currency = dashboard.summary.currencyCode;
  const categories = categoriesQuery.data ?? [];

  return (
    <Screen scroll>
      <StatusBar style="dark" />
      {header}
      <RefreshNotice
        error={categoriesQuery.isRefetchError ? categoriesQuery.error : null}
        onRetry={() => void categoriesQuery.refetch()}
      />
      <AppText variant="body" color="textMuted" style={styles.intro}>
        Categories come from Kiburan&apos;s shared lookup list. Planned amounts are the sum of
        expense estimates; actual amounts are committed costs.
      </AppText>
      <View style={styles.list}>
        {categories.map((category) => {
          const row = byId.get(category.id);
          const allocated = row?.allocated ?? 0;
          const actual = row?.actual ?? 0;
          return (
            <Pressable
              key={category.id}
              onPress={() =>
                router.push(
                  `/(app)/weddings/${weddingId}/budget/expenses?categoryId=${category.id}` as Href,
                )
              }>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <AppText variant="subtitle" style={styles.name}>
                    {category.name_en}
                  </AppText>
                  {row?.overAllocated ? <Badge label="Over allocated" tone="danger" /> : null}
                </View>
                <AppText variant="caption" color="textMuted">
                  Planned {formatMoney(allocated, currency)} · Actual {formatMoney(actual, currency)}
                </AppText>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  intro: {
    marginBottom: spacing.lg,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    color: colors.text,
  },
  });
}
