import { describe, expect, it } from 'vitest';

import type { TaskWithRelations } from '@/features/checklist/types';
import {
  computeChecklistProgress,
  filterTasks,
  isTaskOverdue,
} from './taskHelpers';

function task(partial: Partial<TaskWithRelations> & Pick<TaskWithRelations, 'id' | 'title'>): TaskWithRelations {
  return {
    wedding_id: 'w1',
    event_id: null,
    category_id: null,
    template_id: null,
    parent_task_id: null,
    description: null,
    status: 'todo',
    priority: 'medium',
    due_date: null,
    completed_at: null,
    created_by: null,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    category: null,
    assignees: [],
    ...partial,
  };
}

describe('isTaskOverdue', () => {
  it('flags past incomplete tasks', () => {
    expect(isTaskOverdue(task({ id: '1', title: 'A', due_date: '2020-01-01' }), '2026-01-01')).toBe(
      true,
    );
  });

  it('ignores completed tasks', () => {
    expect(
      isTaskOverdue(task({ id: '1', title: 'A', due_date: '2020-01-01', status: 'done' }), '2026-01-01'),
    ).toBe(false);
  });
});

describe('computeChecklistProgress', () => {
  it('computes completion percent', () => {
    const progress = computeChecklistProgress([
      task({ id: '1', title: 'A', status: 'done' }),
      task({ id: '2', title: 'B', status: 'todo' }),
      task({ id: '3', title: 'C', status: 'cancelled' }),
    ]);
    expect(progress.total).toBe(2);
    expect(progress.completed).toBe(1);
    expect(progress.percent).toBe(50);
  });
});

describe('filterTasks', () => {
  const sample = [
    task({ id: '1', title: 'Book venue', status: 'todo', category_id: 'c1', due_date: '2020-01-01' }),
    task({ id: '2', title: 'Hire DJ', status: 'in_progress', category_id: 'c2' }),
    task({ id: '3', title: 'Send invites', status: 'done', category_id: 'c1' }),
  ];

  it('filters by status and search', () => {
    expect(filterTasks(sample, { status: 'todo' })).toHaveLength(1);
    expect(filterTasks(sample, { status: 'in_progress' })[0]?.title).toBe('Hire DJ');
    expect(filterTasks(sample, { status: 'all', query: 'venue' })).toHaveLength(1);
    expect(filterTasks(sample, { status: 'overdue' })).toHaveLength(1);
    expect(filterTasks(sample, { status: 'all', categoryId: 'c1' })).toHaveLength(2);
  });
});
