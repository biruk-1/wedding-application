import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { ChecklistSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { CategoryCard } from '@/features/checklist/components/CategoryCard';
import {
  ChecklistStatusTabs,
  type ChecklistTab,
} from '@/features/checklist/components/ChecklistStatusTabs';
import { TaskRow } from '@/features/checklist/components/TaskRow';
import {
  useInitializeTemplates,
  useTaskCategories,
  useTemplateCount,
  useToggleTaskStatus,
  useWeddingTasks,
} from '@/features/checklist/queries';
import type { TaskWithRelations } from '@/features/checklist/types';
import {
  buildCategoryProgress,
  countByChecklistTab,
  type CategoryProgressRow,
} from '@/features/checklist/utils/categoryProgress';
import { filterTasks } from '@/features/checklist/utils/taskHelpers';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { errorMessage } from '@/lib/query/queryError';
import { useColors } from '@/theme/WeddingThemeContext';
import { spacing } from '@/theme/spacing';

const EMPTY_TASKS: TaskWithRelations[] = [];

export function ChecklistScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId, categoryId: categoryParam } = useLocalSearchParams<{
    weddingId: string;
    categoryId?: string;
  }>();

  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const tasksQuery = useWeddingTasks(weddingId);
  const categoriesQuery = useTaskCategories();
  const templateCountQuery = useTemplateCount();
  const toggle = useToggleTaskStatus(weddingId ?? '');
  const initialize = useInitializeTemplates(weddingId ?? '');

  const [tab, setTab] = useState<ChecklistTab>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    categoryParam ?? null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const templateCount = templateCountQuery.data ?? 0;
  const counts = useMemo(() => countByChecklistTab(tasks), [tasks]);
  const categoryRows = useMemo(
    () => buildCategoryProgress(categories, tasks, tab),
    [categories, tasks, tab],
  );

  const selectedCategory =
    selectedCategoryId && selectedCategoryId !== '__none__'
      ? categories.find((c) => c.id === selectedCategoryId)
      : selectedCategoryId === '__none__'
        ? { id: '__none__', name_en: 'Other' }
        : null;

  const categoryTasks = useMemo(() => {
    if (!selectedCategoryId) return [];
    if (selectedCategoryId === '__none__') {
      return tasks.filter((t) => {
        if (t.category_id || t.status === 'cancelled') return false;
        if (tab === 'done') return t.status === 'done';
        if (tab === 'todo') return t.status !== 'done';
        return true;
      });
    }
    const base = filterTasks(tasks, {
      status: 'all',
      categoryId: selectedCategoryId,
    });
    if (tab === 'todo') return base.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
    if (tab === 'done') return base.filter((t) => t.status === 'done');
    return base.filter((t) => t.status !== 'cancelled');
  }, [tasks, selectedCategoryId, tab]);

  const toggleStatus = toggle.mutate;
  const onToggleComplete = useCallback(
    (taskId: string, currentlyDone: boolean) => {
      if (!canWrite) return;
      setActionError(null);
      toggleStatus(
        { taskId, status: currentlyDone ? 'todo' : 'done' },
        { onError: (error) => setActionError(errorMessage(error)) },
      );
    },
    [canWrite, toggleStatus],
  );

  const onOpenTask = useCallback(
    (taskId: string) => router.push(`/(app)/weddings/${weddingId}/checklist/${taskId}` as Href),
    [router, weddingId],
  );

  const onOpenCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
    setMenuOpen(false);
  }, []);

  function onInitializeTemplates() {
    if (!weddingId || !canWrite || initialize.isPending) return;
    setActionError(null);
    setMenuOpen(false);
    initialize.mutate(wedding.data?.wedding_date ?? null, {
      onError: (error) => setActionError(errorMessage(error)),
      onSuccess: (result) =>
        Alert.alert(
          'Checklist ready',
          result.inserted === 0
            ? 'Template tasks were already added for this wedding.'
            : `Added ${result.inserted} tasks from the starter checklist.`,
        ),
    });
  }

  const showingCategories = !selectedCategoryId;
  const data = showingCategories ? categoryRows : categoryTasks;

  const renderItem = useCallback(
    ({ item, index }: { item: CategoryProgressRow | TaskWithRelations; index: number }) => {
      if (showingCategories) {
        const row = item as CategoryProgressRow;
        return <CategoryCard row={row} index={index} onPress={onOpenCategory} />;
      }
      const task = item as TaskWithRelations;
      return (
        <TaskRow
          task={task}
          canWrite={canWrite}
          onPress={() => onOpenTask(task.id)}
          onToggleComplete={() => onToggleComplete(task.id, task.status === 'done')}
        />
      );
    },
    [showingCategories, canWrite, onOpenCategory, onOpenTask, onToggleComplete],
  );

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      {selectedCategoryId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to categories"
          hitSlop={12}
          onPress={() => setSelectedCategoryId(null)}
          style={styles.headerSide}>
          <Ionicons name="chevron-back" size={24} color={colors.success} />
        </Pressable>
      ) : (
        <View style={styles.headerSide} />
      )}
      <View style={styles.headerTitles}>
        <AppText variant="title" color="heading" style={styles.headerTitle}>
          {selectedCategory ? selectedCategory.name_en : 'Wedding Checklist'}
        </AppText>
        {!selectedCategory ? (
          <AppText variant="caption" color="textMuted" style={styles.headerSub}>
            {wedding.data?.title}
          </AppText>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Checklist options"
        hitSlop={12}
        onPress={() => setMenuOpen((open) => !open)}
        style={styles.headerSide}>
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.heading} />
      </Pressable>
    </View>
  );

  if (tasksQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <ChecklistSkeleton />
      </Screen>
    );
  }

  if (tasksQuery.isError && !tasksQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {errorMessage(tasksQuery.error)}
          </AppText>
          <Button
            label="Retry"
            loading={tasksQuery.isFetching}
            onPress={() => void tasksQuery.refetch()}
          />
        </View>
      </Screen>
    );
  }

  const listHeader = (
    <View>
      {header}
      {menuOpen ? (
        <View style={styles.menu}>
          {canWrite ? (
            <>
              <Button
                label="Add task"
                size="compact"
                fullWidth={false}
                onPress={() => {
                  setMenuOpen(false);
                  router.push(`/(app)/weddings/${weddingId}/checklist/new` as Href);
                }}
              />
              {templateCount > 0 ? (
                <Button
                  label="Use starter checklist"
                  variant="secondary"
                  size="compact"
                  fullWidth={false}
                  loading={initialize.isPending}
                  onPress={onInitializeTemplates}
                />
              ) : null}
            </>
          ) : (
            <AppText variant="caption" color="textMuted">
              Viewers can browse tasks but not edit them.
            </AppText>
          )}
        </View>
      ) : null}
      <RefreshNotice
        error={tasksQuery.isRefetchError ? tasksQuery.error : null}
        onRetry={() => void tasksQuery.refetch()}
      />
      <ChecklistStatusTabs value={tab} counts={counts} onChange={setTab} />
      {actionError ? (
        <AppText color="danger" variant="caption" style={[styles.center, styles.actionError]}>
          {actionError}
        </AppText>
      ) : null}
    </View>
  );

  const emptyTasks =
    tasks.length === 0 ? (
      <View style={styles.empty}>
        <AppText variant="subtitle" style={styles.center}>
          No tasks yet
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.center}>
          Create your first task or load the starter checklist
          {templateCount > 0 ? ` (${templateCount} templates)` : ''}.
        </AppText>
        {canWrite ? (
          <>
            {templateCount > 0 ? (
              <Button
                label="Use starter checklist"
                loading={initialize.isPending}
                onPress={onInitializeTemplates}
              />
            ) : null}
            <Button
              label="Create task"
              variant="secondary"
              onPress={() => router.push(`/(app)/weddings/${weddingId}/checklist/new` as Href)}
            />
          </>
        ) : null}
      </View>
    ) : (
      <AppText color="textMuted" style={[styles.center, styles.noMatch]}>
        Nothing in this view yet.
      </AppText>
    );

  return (
    <View style={styles.root}>
      <Screen padded={false}>
        <StatusBar style="dark" />
        <FlatList
          data={data as (CategoryProgressRow | TaskWithRelations)[]}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyTasks}
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[styles.content, { paddingBottom: tabInset }]}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={tasksQuery.isRefetching && !toggle.isPending}
              onRefresh={() => void tasksQuery.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerSide: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingTop: spacing.xs,
  },
  headerTitle: {
    textAlign: 'center',
  },
  headerSub: {
    textAlign: 'center',
  },
  menu: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionError: {
    marginBottom: spacing.md,
  },
  empty: {
    gap: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  noMatch: {
    paddingVertical: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
  center: {
    textAlign: 'center',
  },
});
