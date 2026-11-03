import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { ExpenseListSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TextField } from '@/components/ui/TextField';
import { ExpenseRow } from '@/features/budget/components/ExpenseRow';
import {
  useBudgetCategories,
  useBudgetItemList,
  useWeddingBudget,
} from '@/features/budget/queries';
import type { BudgetItemListItem } from '@/features/budget/types';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function ExpenseListScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { weddingId, categoryId: categoryParam } = useLocalSearchParams<{
    weddingId: string;
    categoryId?: string;
  }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/budget`);
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const budgetQuery = useWeddingBudget(weddingId);
  const categoriesQuery = useBudgetCategories();

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(categoryParam ?? null);

  const list = useBudgetItemList(weddingId, { query, categoryId });
  const currency = budgetQuery.data?.currency_code ?? 'ETB';

  const onOpen = useCallback(
    (itemId: string) =>
      router.push(`/(app)/weddings/${weddingId}/budget/expenses/${itemId}` as Href),
    [router, weddingId],
  );

  const renderItem = useCallback(
    ({ item }: { item: BudgetItemListItem }) => (
      <ExpenseRow item={item} currencyCode={currency} onOpen={onOpen} />
    ),
    [currency, onOpen],
  );

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <Header title="Expenses" subtitle={wedding.data?.title} showBack onBack={goBack} />
  );

  if (list.isLoading && list.items.length === 0) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <ExpenseListSkeleton />
      </Screen>
    );
  }

  if (list.error && list.items.length === 0) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(list.error)}
          </AppText>
          <Button label="Retry" onPress={list.refresh} />
        </View>
      </Screen>
    );
  }

  const listHeader = (
    <View>
      {header}
      <RefreshNotice error={list.refreshError} onRetry={list.refresh} />
      <TextField
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Search expenses"
        containerStyle={styles.search}
      />
      <View style={styles.chips}>
        <Chip label="All" active={categoryId == null} onPress={() => setCategoryId(null)} />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name_en}
            active={categoryId === category.id}
            onPress={() => setCategoryId(category.id)}
          />
        ))}
      </View>
      {canWrite ? (
        <Button
          label="Add expense"
          onPress={() => router.push(`/(app)/weddings/${weddingId}/budget/expenses/new` as Href)}
          style={styles.add}
        />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl refreshing={list.isRefetching} onRefresh={list.refresh} />
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <AppText color="textMuted" style={styles.center}>
            No expenses match these filters.
          </AppText>
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <AppText color="textMuted" style={styles.center}>
              Loading more…
            </AppText>
          ) : undefined
        }
      />
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <AppText variant="caption" color={active ? 'onSuccess' : 'text'}>
        {label}
      </AppText>
    </Pressable>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
    gap: spacing.md,
  },
  search: {
    marginBottom: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  add: {
    marginBottom: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  block: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  center: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  });
}
