import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addTaskComment,
  createTask,
  deleteTask,
  getWeddingTask,
  initializeChecklistFromTemplates,
  listChecklistTemplates,
  listTaskCategories,
  listTaskComments,
  listWeddingMembersForAssign,
  listWeddingTasks,
  setTaskStatus,
  updateTask,
} from '@/features/checklist/services/checklistService';
import {
  applyOptimisticStatus,
  dropTask,
  invalidateWeddingTasks,
  writeTask,
} from '@/features/checklist/taskCacheOps';
import type { CreateTaskInput, TaskWithRelations, UpdateTaskInput } from '@/features/checklist/types';
import { useUserId } from '@/features/weddings/queries';
import { QueryError, unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

const TOGGLE_MUTATION_KEY = ['checklist', 'toggle-status'] as const;

export function useTaskCategories() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.taskCategories(userId ?? ''),
    queryFn: async () => unwrap(await listTaskCategories()),
    enabled: Boolean(userId),
    staleTime: staleTimes.reference,
  });
}

export function useTemplateCount() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.checklistTemplateCount(userId ?? ''),
    queryFn: async () => {
      const templates = unwrap(await listChecklistTemplates());
      return templates.length;
    },
    enabled: Boolean(userId),
    staleTime: staleTimes.reference,
  });
}

export function useWeddingTasks(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.tasks(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await listWeddingTasks(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

/** Task detail, seeded from the checklist list so opening a task renders immediately. */
export function useTask(weddingId: string | undefined, taskId: string | undefined) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const listKey = queryKeys.tasks(userId ?? '', weddingId ?? '');
  return useQuery({
    queryKey: queryKeys.task(userId ?? '', weddingId ?? '', taskId ?? ''),
    queryFn: async () => unwrap(await getWeddingTask(taskId!)),
    enabled: Boolean(userId && weddingId && taskId),
    staleTime: staleTimes.collaborative,
    initialData: () =>
      queryClient.getQueryData<TaskWithRelations[]>(listKey)?.find((task) => task.id === taskId),
    initialDataUpdatedAt: () => queryClient.getQueryState(listKey)?.dataUpdatedAt,
  });
}

export function useTaskComments(weddingId: string | undefined, taskId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.taskComments(userId ?? '', weddingId ?? '', taskId ?? ''),
    queryFn: async () => unwrap(await listTaskComments(taskId!)),
    enabled: Boolean(userId && weddingId && taskId),
    staleTime: staleTimes.collaborative,
  });
}

export function useAssignableMembers(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingMembers(userId ?? '', weddingId ?? ''),
    queryFn: async () => unwrap(await listWeddingMembersForAssign(weddingId!)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.wedding,
  });
}

function requireUser(userId: string | null): string {
  if (!userId) throw new QueryError({ code: 'unauthenticated', message: 'Please sign in again.' });
  return userId;
}

export function useToggleTaskStatus(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: TOGGLE_MUTATION_KEY,
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskWithRelations['status'] }) =>
      unwrap(await setTaskStatus(taskId, status)),
    onMutate: async ({ taskId, status }) => {
      const rollback = await applyOptimisticStatus(
        queryClient,
        { userId: requireUser(userId), weddingId },
        taskId,
        status,
      );
      return { rollback };
    },
    onError: (_error, _variables, context) => context?.rollback(),
    onSuccess: (task) => writeTask(queryClient, { userId: requireUser(userId), weddingId }, task),
    onSettled: () => {
      if (userId && queryClient.isMutating({ mutationKey: TOGGLE_MUTATION_KEY }) === 1) {
        void invalidateWeddingTasks(queryClient, { userId, weddingId });
      }
    },
  });
}

export function useSaveTask(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input:
        | { mode: 'create'; values: Omit<CreateTaskInput, 'weddingId'> }
        | { mode: 'edit'; taskId: string; values: UpdateTaskInput },
    ) => {
      requireUser(userId);
      return unwrap(
        input.mode === 'create'
          ? await createTask({ weddingId, ...input.values })
          : await updateTask(input.taskId, input.values),
      );
    },
    onSuccess: (task) => {
      const uid = requireUser(userId);
      writeTask(queryClient, { userId: uid, weddingId }, task);
      void invalidateWeddingTasks(queryClient, { userId: uid, weddingId });
    },
  });
}

export function useDeleteTask(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => unwrap(await deleteTask(taskId)),
    onSuccess: (_result, taskId) => {
      const uid = requireUser(userId);
      dropTask(queryClient, { userId: uid, weddingId }, taskId);
      void invalidateWeddingTasks(queryClient, { userId: uid, weddingId });
    },
  });
}

export function useInitializeTemplates(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (weddingDate: string | null) =>
      unwrap(await initializeChecklistFromTemplates(weddingId, weddingDate)),
    onSuccess: () =>
      invalidateWeddingTasks(queryClient, { userId: requireUser(userId), weddingId }),
  });
}

export function useAddComment(weddingId: string, taskId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => unwrap(await addTaskComment(taskId, body)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.taskComments(requireUser(userId), weddingId, taskId),
      }),
  });
}
