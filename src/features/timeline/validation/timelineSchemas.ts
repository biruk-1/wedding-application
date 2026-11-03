import { z } from 'zod';

import { EVENT_TYPES } from '@/features/timeline/types';
import { isDateKey, isTimeHm } from '@/features/timeline/utils/datetime';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null));

const dateField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value == null || isDateKey(value), {
    message: 'Use date format YYYY-MM-DD',
  });

const timeField = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null))
  .refine((value) => value == null || isTimeHm(value), {
    message: 'Use time format HH:MM',
  });

export const eventFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Event name is required').max(160, 'Name is too long'),
    eventType: z.string().trim().min(1).max(40).default('other'),
    startDate: dateField,
    startTime: timeField,
    endDate: dateField,
    endTime: timeField,
    venueName: optionalTrimmed(160),
    address: optionalTrimmed(240),
    city: optionalTrimmed(80),
    notes: optionalTrimmed(2000),
  })
  .superRefine((value, ctx) => {
    if (value.startTime && !value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Add a start date for the time' });
    }
    if (value.endTime && !value.endDate && !value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Add an end date for the time' });
    }
    if ((value.endDate || value.endTime) && !value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Set a start date before the end' });
    }
  });

export const timelineItemFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(160, 'Title is too long'),
    startDate: dateField,
    startTime: timeField,
    endDate: dateField,
    endTime: timeField,
    notes: optionalTrimmed(2000),
  })
  .superRefine((value, ctx) => {
    if (value.startTime && !value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Add a start date for the time' });
    }
    if ((value.endDate || value.endTime) && !value.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Set a start date before the end' });
    }
  });

export type EventFormValues = z.infer<typeof eventFormSchema>;
export type TimelineItemFormValues = z.infer<typeof timelineItemFormSchema>;

export const suggestedEventTypes = EVENT_TYPES;

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !result[key]) result[key] = issue.message;
  }
  return result;
}
