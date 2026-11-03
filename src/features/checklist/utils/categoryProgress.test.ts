import { describe, expect, it } from 'vitest';

import {
  buildCategoryProgress,
  countByChecklistTab,
} from '@/features/checklist/utils/categoryProgress';
import type { TaskCategory, TaskWithRelations } from '@/features/checklist/types';

const categories: TaskCategory[] = [
  {
    id: 'c1',
    slug: 'venue',
    name_en: 'Venue',
    name_am: null,
    icon: 'venue',
    sort_order: 10,
    is_active: true,
  },
  {
    id: 'c2',
    slug: 'catering',
    name_en: 'Catering',
    name_am: null,
    icon: 'food',
    sort_order: 20,
    is_active: true,
  },
];

function task(
  partial: Partial<TaskWithRelations> & Pick<TaskWithRelations, 'id' | 'title' | 'status'>,
): TaskWithRelations {
  return {
    wedding_id: 'w1',
    description: null,
    category_id: null,
    due_date: null,
    priority: 'medium',
    sort_order: 0,
    created_by: null,
    created_at: '',
    updated_at: '',
    completed_at: null,
    event_id: null,
    parent_task_id: null,
    template_id: null,
    category: null,
    assignees: [],
    ...partial,
  };
}

describe('countByChecklistTab', () => {
  it('splits active tasks into all / todo / done', () => {
    const tasks = [
      task({ id: '1', title: 'A', status: 'todo' }),
      task({ id: '2', title: 'B', status: 'done' }),
      task({ id: '3', title: 'C', status: 'in_progress' }),
      task({ id: '4', title: 'D', status: 'cancelled' }),
    ];
    expect(countByChecklistTab(tasks)).toEqual({ all: 3, todo: 2, done: 1 });
  });
});

describe('buildCategoryProgress', () => {
  it('groups by category with completion counts', () => {
    const tasks = [
      task({ id: '1', title: 'A', status: 'done', category_id: 'c1' }),
      task({ id: '2', title: 'B', status: 'todo', category_id: 'c1' }),
      task({ id: '3', title: 'C', status: 'todo', category_id: 'c2' }),
    ];
    const rows = buildCategoryProgress(categories, tasks, 'all');
    expect(rows).toEqual([
      expect.objectContaining({ id: 'c1', total: 2, completed: 1 }),
      expect.objectContaining({ id: 'c2', total: 1, completed: 0 }),
    ]);
  });

  it('shows empty categories when there are no tasks', () => {
    const rows = buildCategoryProgress(categories, [], 'all');
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });
});
