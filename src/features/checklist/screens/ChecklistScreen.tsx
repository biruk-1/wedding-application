import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { ProgressHeader } from '@/features/checklist/components/ProgressHeader';
import { TaskFilterBar } from '@/features/checklist/components/TaskFilterBar';
import { TaskRow } from '@/features/checklist/components/TaskRow';
import { useWeddingChecklist } from '@/features/checklist/hooks/useWeddingChecklist';
import {
  initializeChecklistFromTemplates,
  listChecklistTemplates,
  setTaskStatus,
} from '@/features/checklist/services/checklistService';
import { getWeddingById } from '@/features/weddings/services/weddingService';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/spacing';

export function ChecklistScreen() {
  const router = useRouter();
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const checklist = useWeddingChecklist(weddingId);
  const [weddingTitle, setWeddingTitle] = useState('Checklist');
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [templateCount, setTemplateCount] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!weddingId) return;
    let cancelled = false;
    void (async () => {
      const [weddingResult, templatesResult, membership] = await Promise.all([
        getWeddingById(weddingId),
        listChecklistTemplates(),
        supabase
          .from('wedding_members')
          .select('role')
          .eq('wedding_id', weddingId)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (weddingResult.ok) {
        setWeddingTitle(weddingResult.data.title);
        setWeddingDate(weddingResult.data.wedding_date);
      }
      if (templatesResult.ok) setTemplateCount(templatesResult.data.length);
      const role = membership.data?.role;
      setCanWrite(Boolean(role && role !== 'viewer'));
    })();
    return () => {
      cancelled = true;
    };
  }, [weddingId]);

  const onToggleComplete = useCallback(
    async (taskId: string, currentlyDone: boolean) => {
      if (!canWrite) return;
      setActionError(null);
      const previous = checklist.tasks.find((task) => task.id === taskId);
      const nextStatus = currentlyDone ? 'todo' : 'done';
      if (previous) {
        checklist.replaceTask({ ...previous, status: nextStatus });
      }
      const result = await setTaskStatus(taskId, nextStatus);
      if (!result.ok) {
        if (previous) checklist.replaceTask(previous);
        setActionError(result.error.message);
        return;
      }
      checklist.replaceTask(result.data);
    },
    [canWrite, checklist],
  );

  async function onInitializeTemplates() {
    if (!weddingId || !canWrite) return;
    setInitializing(true);
    setActionError(null);
    const result = await initializeChecklistFromTemplates(weddingId, weddingDate);
    setInitializing(false);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    checklist.refresh();
    Alert.alert(
      'Checklist ready',
      result.data.inserted === 0
        ? 'Template tasks were already added for this wedding.'
        : `Added ${result.data.inserted} tasks from the starter checklist.`,
    );
  }

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  if (checklist.isLoading) {
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
        title="Checklist"
        subtitle={weddingTitle}
        showBack
        onBack={() => router.replace(`/(app)/weddings/${weddingId}` as Href)}
      />

      {checklist.error ? (
        <View style={styles.block}>
          <AppText color="danger" style={styles.center}>
            {checklist.error.message}
          </AppText>
          <Button label="Retry" onPress={checklist.refresh} />
        </View>
      ) : null}

      <ProgressHeader progress={checklist.progress} />
      <TaskFilterBar
        status={checklist.statusFilter}
        onStatusChange={checklist.setStatusFilter}
        categories={checklist.categories}
        categoryId={checklist.categoryId}
        onCategoryChange={checklist.setCategoryId}
        query={checklist.query}
        onQueryChange={checklist.setQuery}
      />

      {actionError ? (
        <AppText color="danger" variant="caption" style={styles.center}>
          {actionError}
        </AppText>
      ) : null}

      {checklist.tasks.length === 0 ? (
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
                  loading={initializing}
                  onPress={() => void onInitializeTemplates()}
                />
              ) : null}
              <Button
                label="Create task"
                variant="secondary"
                onPress={() =>
                  router.push(`/(app)/weddings/${weddingId}/checklist/new` as Href)
                }
              />
            </>
          ) : (
            <AppText variant="caption" color="textMuted" style={styles.center}>
              Viewers can browse tasks once writers add them.
            </AppText>
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {checklist.filtered.length === 0 ? (
            <AppText color="textMuted" style={styles.center}>
              No tasks match these filters.
            </AppText>
          ) : (
            checklist.filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canWrite={canWrite}
                onPress={() =>
                  router.push(`/(app)/weddings/${weddingId}/checklist/${task.id}` as Href)
                }
                onToggleComplete={() => void onToggleComplete(task.id, task.status === 'done')}
              />
            ))
          )}
        </View>
      )}

      {checklist.tasks.length > 0 && canWrite ? (
        <View style={styles.footer}>
          <Button
            label="Add task"
            onPress={() => router.push(`/(app)/weddings/${weddingId}/checklist/new` as Href)}
          />
          {templateCount > 0 ? (
            <Button
              label="Add missing template tasks"
              variant="secondary"
              loading={initializing}
              onPress={() => void onInitializeTemplates()}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  empty: {
    gap: spacing.lg,
    paddingVertical: spacing['2xl'],
  },
  list: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  footer: {
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  center: {
    textAlign: 'center',
  },
});
