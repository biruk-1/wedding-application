import type { QueryClient } from '@tanstack/react-query';

import type { TaskWithRelations } from '@/features/checklist/types';
import {
  removeTaskFromList,
  replaceTaskInList,
  upsertTaskInList,
  withStatus,
} from '@/features/checklist/utils/taskCache';
import { queryKeys } from '@/lib/query/queryKeys';

type Scope = { userId: string; weddingId: string };

/**
 * Applies a status change to the cached list and detail entries and returns a rollback that
 * restores only this task, so a failure does not undo other tasks toggled concurrently.
 */
export async function applyOptimisticStatus(
  queryClient: QueryClient,
  { userId, weddingId }: Scope,
  taskId: string,
  status: TaskWithRelations['status'],
): Promise<() => void> {
  const listKey = queryKeys.tasks(userId, weddingId);
  const detailKey = queryKeys.task(userId, weddingId, taskId);
  // Prevent an in-flight refetch from overwriting the optimistic value.
  await queryClient.cancelQueries({ queryKey: listKey });

  const previous =
    queryClient.getQueryData<TaskWithRelations>(detailKey) ??
    queryClient.getQueryData<TaskWithRelations[]>(listKey)?.find((task) => task.id === taskId);
  if (!previous) return () => {};

  const optimistic = withStatus(previous, status);
  queryClient.setQueryData<TaskWithRelations[]>(listKey, (list) => replaceTaskInList(list, optimistic));
  queryClient.setQueryData<TaskWithRelations>(detailKey, optimistic);

  return () => {
    queryClient.setQueryData<TaskWithRelations[]>(listKey, (list) => replaceTaskInList(list, previous));
    queryClient.setQueryData<TaskWithRelations>(detailKey, previous);
  };
}

/** Writes a server-confirmed task into both the list and the detail cache. */
export function writeTask(queryClient: QueryClient, { userId, weddingId }: Scope, task: TaskWithRelations) {
  queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasks(userId, weddingId), (list) =>
    upsertTaskInList(list, task),
  );
  queryClient.setQueryData(queryKeys.task(userId, weddingId, task.id), task);
}

/**
 * The detail entry is left to garbage collection: the deleting screen still observes it, and
 * removing it there would trigger a refetch of a row that no longer exists.
 */
export function dropTask(queryClient: QueryClient, { userId, weddingId }: Scope, taskId: string) {
  queryClient.setQueryData<TaskWithRelations[]>(queryKeys.tasks(userId, weddingId), (list) =>
    removeTaskFromList(list, taskId),
  );
}

/** Refreshes only this wedding's task list; detail entries are written from server responses. */
export function invalidateWeddingTasks(queryClient: QueryClient, { userId, weddingId }: Scope) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tasks(userId, weddingId), exact: true });
}
