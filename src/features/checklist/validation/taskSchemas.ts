import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const taskStatuses = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
export const taskPriorities = ['low', 'medium', 'high', 'urgent'] as const;

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(160, 'Title is too long'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description is too long')
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  categoryId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => value === undefined || ISO_DATE.test(value), {
      message: 'Use date format YYYY-MM-DD',
    }),
  priority: z.enum(taskPriorities).default('medium'),
  status: z.enum(taskStatuses).default('todo'),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !result[key]) {
      result[key] = issue.message;
    }
  }
  return result;
}

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
});
