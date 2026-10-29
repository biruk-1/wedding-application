import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listTaskCategories,
  listWeddingTasks,
} from '@/features/checklist/services/checklistService';
import type { ChecklistUserMessage } from '@/features/checklist/services/checklistErrors';
import type { StatusFilter, TaskCategory, TaskWithRelations } from '@/features/checklist/types';
import {
  computeChecklistProgress,
  filterTasks,
} from '@/features/checklist/utils/taskHelpers';

export function useWeddingChecklist(weddingId: string | undefined) {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChecklistUserMessage | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!weddingId) return;
    let cancelled = false;

    void (async () => {
      const [tasksResult, categoriesResult] = await Promise.all([
        listWeddingTasks(weddingId),
        listTaskCategories(),
      ]);
      if (cancelled) return;

      if (!tasksResult.ok) {
        setError(tasksResult.error);
        setTasks([]);
      } else {
        setTasks(tasksResult.data);
        setError(null);
      }

      if (categoriesResult.ok) {
        setCategories(categoriesResult.data);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [weddingId, reloadToken]);

  const progress = useMemo(() => computeChecklistProgress(tasks), [tasks]);
  const filtered = useMemo(
    () => filterTasks(tasks, { status: statusFilter, categoryId, query }),
    [tasks, statusFilter, categoryId, query],
  );

  const replaceTask = useCallback((next: TaskWithRelations) => {
    setTasks((current) => current.map((task) => (task.id === next.id ? next : task)));
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }, []);

  return {
    tasks,
    filtered,
    categories,
    progress,
    isLoading,
    error,
    refresh,
    statusFilter,
    setStatusFilter,
    categoryId,
    setCategoryId,
    query,
    setQuery,
    replaceTask,
    removeTask,
  };
}
