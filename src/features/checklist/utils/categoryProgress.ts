import type { TaskCategory, TaskWithRelations } from '@/features/checklist/types';

export type CategoryProgressRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  total: number;
  completed: number;
};

export type ChecklistTab = 'all' | 'todo' | 'done' | 'mine';

export function countByChecklistTab(tasks: TaskWithRelations[], currentUserId?: string | null) {
  const active = tasks.filter((t) => t.status !== 'cancelled');
  const done = active.filter((t) => t.status === 'done').length;
  const mine = currentUserId
    ? active.filter((t) => t.assignees.some((a) => a.user_id === currentUserId)).length
    : 0;
  return { all: active.length, todo: active.length - done, done, mine };
}

function matchesTab(
  task: TaskWithRelations,
  tab: ChecklistTab,
  currentUserId?: string | null,
): boolean {
  if (task.status === 'cancelled') return false;
  if (tab === 'todo') return task.status !== 'done';
  if (tab === 'done') return task.status === 'done';
  if (tab === 'mine') {
    return Boolean(currentUserId && task.assignees.some((a) => a.user_id === currentUserId));
  }
  return true;
}

/**
 * Category overview for the checklist landing screen.
 * Completion counts are always overall for the category; the tab only filters which rows appear.
 */
export function buildCategoryProgress(
  categories: TaskCategory[],
  tasks: TaskWithRelations[],
  tab: ChecklistTab = 'all',
  currentUserId?: string | null,
): CategoryProgressRow[] {
  const sorted = [...categories]
    .filter((c) => c.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en));

  const active = tasks.filter((t) => t.status !== 'cancelled');

  if (active.length === 0) {
    return sorted.map((category) => ({
      id: category.id,
      name: category.name_en,
      slug: category.slug,
      icon: category.icon,
      total: 0,
      completed: 0,
    }));
  }

  const rows: CategoryProgressRow[] = [];

  for (const category of sorted) {
    const inCategory = active.filter((t) => t.category_id === category.id);
    if (inCategory.length === 0) continue;
    if (!inCategory.some((t) => matchesTab(t, tab, currentUserId))) continue;
    rows.push({
      id: category.id,
      name: category.name_en,
      slug: category.slug,
      icon: category.icon,
      total: inCategory.length,
      completed: inCategory.filter((t) => t.status === 'done').length,
    });
  }

  const uncategorized = active.filter((t) => !t.category_id);
  if (uncategorized.length > 0 && uncategorized.some((t) => matchesTab(t, tab, currentUserId))) {
    rows.push({
      id: '__none__',
      name: 'Other',
      slug: 'other',
      icon: null,
      total: uncategorized.length,
      completed: uncategorized.filter((t) => t.status === 'done').length,
    });
  }

  return rows;
}
