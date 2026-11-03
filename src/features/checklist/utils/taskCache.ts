import type { TaskWithRelations } from '@/features/checklist/types';

export function replaceTaskInList(
  list: TaskWithRelations[] | undefined,
  task: TaskWithRelations,
): TaskWithRelations[] | undefined {
  if (!list) return list;
  return list.map((item) => (item.id === task.id ? task : item));
}

export function upsertTaskInList(
  list: TaskWithRelations[] | undefined,
  task: TaskWithRelations,
): TaskWithRelations[] | undefined {
  if (!list) return list;
  return list.some((item) => item.id === task.id)
    ? replaceTaskInList(list, task)
    : [...list, task];
}

export function removeTaskFromList(
  list: TaskWithRelations[] | undefined,
  taskId: string,
): TaskWithRelations[] | undefined {
  if (!list) return list;
  return list.filter((item) => item.id !== taskId);
}

export function withStatus(
  task: TaskWithRelations,
  status: TaskWithRelations['status'],
): TaskWithRelations {
  return {
    ...task,
    status,
    completed_at: status === 'done' ? task.completed_at ?? new Date().toISOString() : null,
  };
}
