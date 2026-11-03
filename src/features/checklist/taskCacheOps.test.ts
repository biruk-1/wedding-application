import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  applyOptimisticStatus,
  dropTask,
  invalidateWeddingTasks,
  writeTask,
} from '@/features/checklist/taskCacheOps';
import type { TaskWithRelations } from '@/features/checklist/types';
import { upsertTaskInList, withStatus } from '@/features/checklist/utils/taskCache';
import { queryKeys } from '@/lib/query/queryKeys';

const scope = { userId: 'user-a', weddingId: 'wedding-1' };

function task(id: string, status: TaskWithRelations['status'] = 'todo'): TaskWithRelations {
  return {
    id,
    wedding_id: scope.weddingId,
    title: `Task ${id}`,
    status,
    completed_at: status === 'done' ? '2026-01-01T00:00:00.000Z' : null,
    category: null,
    assignees: [],
  } as unknown as TaskWithRelations;
}

function seeded() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(queryKeys.tasks(scope.userId, scope.weddingId), [task('1'), task('2')]);
  return client;
}

const list = (client: QueryClient) =>
  client.getQueryData<TaskWithRelations[]>(queryKeys.tasks(scope.userId, scope.weddingId))!;

describe('task cache helpers', () => {
  it('sets and clears completed_at with the status', () => {
    const done = withStatus(task('1'), 'done');
    expect(done.completed_at).toBeTruthy();
    expect(withStatus(done, 'todo').completed_at).toBeNull();
  });

  it('upserts without duplicating rows', () => {
    const rows = [task('1')];
    expect(upsertTaskInList(rows, task('1', 'done'))).toHaveLength(1);
    expect(upsertTaskInList(rows, task('2'))).toHaveLength(2);
    expect(upsertTaskInList(undefined, task('2'))).toBeUndefined();
  });
});

describe('optimistic status toggles', () => {
  it('updates list and detail immediately', async () => {
    const client = seeded();
    await applyOptimisticStatus(client, scope, '1', 'done');
    expect(list(client).find((t) => t.id === '1')?.status).toBe('done');
    expect(
      client.getQueryData<TaskWithRelations>(queryKeys.task(scope.userId, scope.weddingId, '1'))?.status,
    ).toBe('done');
  });

  it('rolls back only the failed task when toggles overlap', async () => {
    const client = seeded();
    const rollbackOne = await applyOptimisticStatus(client, scope, '1', 'done');
    await applyOptimisticStatus(client, scope, '2', 'done');

    rollbackOne();

    expect(list(client).map((t) => [t.id, t.status])).toEqual([
      ['1', 'todo'],
      ['2', 'done'],
    ]);
  });

  it('is a no-op for tasks that are not cached', async () => {
    const client = seeded();
    const rollback = await applyOptimisticStatus(client, scope, 'missing', 'done');
    rollback();
    expect(list(client).map((t) => t.status)).toEqual(['todo', 'todo']);
  });

  it('writes server rows and drops deleted ones', () => {
    const client = seeded();
    writeTask(client, scope, task('3'));
    expect(list(client)).toHaveLength(3);
    dropTask(client, scope, '1');
    expect(list(client).map((t) => t.id)).toEqual(['2', '3']);
  });

  it('invalidates only the affected wedding task list', async () => {
    const client = seeded();
    const other = queryKeys.tasks(scope.userId, 'wedding-2');
    client.setQueryData(other, [task('9')]);
    client.setQueryData(queryKeys.memberships(scope.userId), []);

    await invalidateWeddingTasks(client, scope);

    expect(client.getQueryState(queryKeys.tasks(scope.userId, scope.weddingId))?.isInvalidated).toBe(true);
    expect(client.getQueryState(other)?.isInvalidated).toBe(false);
    expect(client.getQueryState(queryKeys.memberships(scope.userId))?.isInvalidated).toBe(false);
  });
});
