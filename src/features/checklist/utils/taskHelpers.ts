import type { ChecklistProgress, StatusFilter, TaskWithRelations } from '@/features/checklist/types';

export function isTaskOverdue(task: Pick<TaskWithRelations, 'due_date' | 'status'>, todayIso?: string): boolean {
  if (!task.due_date) return false;
  if (task.status === 'done' || task.status === 'cancelled') return false;
  const today =
    todayIso ??
    [
      new Date().getFullYear(),
      String(new Date().getMonth() + 1).padStart(2, '0'),
      String(new Date().getDate()).padStart(2, '0'),
    ].join('-');
  return task.due_date < today;
}

export function computeChecklistProgress(tasks: TaskWithRelations[]): ChecklistProgress {
  const active = tasks.filter((task) => task.status !== 'cancelled');
  const completed = active.filter((task) => task.status === 'done').length;
  const overdue = active.filter((task) => isTaskOverdue(task)).length;
  const upcoming = active.filter(
    (task) => task.due_date && !isTaskOverdue(task) && task.status !== 'done',
  ).length;
  const total = active.length;
  return {
    total,
    completed,
    overdue,
    upcoming,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function filterTasks(
  tasks: TaskWithRelations[],
  options: {
    status: StatusFilter;
    categoryId?: string | null;
    query?: string;
  },
): TaskWithRelations[] {
  const q = options.query?.trim().toLowerCase() ?? '';
  return tasks.filter((task) => {
    if (options.categoryId && task.category_id !== options.categoryId) return false;
    if (q && !task.title.toLowerCase().includes(q)) return false;

    switch (options.status) {
      case 'all':
        return task.status !== 'cancelled';
      case 'todo':
        return task.status === 'todo';
      case 'in_progress':
        return task.status === 'in_progress';
      case 'done':
        return task.status === 'done';
      case 'overdue':
        return isTaskOverdue(task);
      default:
        return true;
    }
  });
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'todo':
      return 'To do';
    case 'in_progress':
      return 'In progress';
    case 'blocked':
      return 'Blocked';
    case 'done':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
