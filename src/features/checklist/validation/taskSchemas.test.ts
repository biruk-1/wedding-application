import { describe, expect, it } from 'vitest';

import { commentSchema, fieldErrorsFromZod, taskFormSchema } from './taskSchemas';

describe('taskFormSchema', () => {
  it('requires a title', () => {
    const result = taskFormSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrorsFromZod(result.error).title).toMatch(/required/i);
    }
  });

  it('accepts a valid task', () => {
    const result = taskFormSchema.safeParse({
      title: 'Book venue',
      dueDate: '2026-08-01',
      priority: 'high',
      status: 'todo',
      assigneeIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects bad dates', () => {
    const result = taskFormSchema.safeParse({ title: 'Task', dueDate: 'Aug 1' });
    expect(result.success).toBe(false);
  });
});

describe('commentSchema', () => {
  it('rejects empty comments', () => {
    expect(commentSchema.safeParse({ body: '   ' }).success).toBe(false);
  });
});
