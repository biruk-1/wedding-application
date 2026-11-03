import { z } from 'zod';

export const guestSides = ['partner_one', 'partner_two', 'both', 'other'] as const;
export const guestTypes = ['family', 'friend', 'coworker', 'other'] as const;
export const rsvpResponses = ['pending', 'yes', 'no', 'maybe'] as const;
export const designLayouts = ['classic', 'floral', 'modern'] as const;
export const eventTypes = ['ceremony', 'reception', 'engagement', 'other'] as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const PHONE = /^[+()\d\s-]{6,25}$/;

/** Trimmed optional text; empty input becomes `undefined`. */
function optionalText(max: number, message: string) {
  return z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));
}

/** Optional enum from a form chip where '' means "not set". */
function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .enum(values)
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? (value as T[number]) : undefined));
}

export const guestFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Guest name is required').max(120, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => value === undefined || PHONE.test(value), {
      message: 'Enter a valid phone number',
    }),
  email: z
    .string()
    .trim()
    .max(254, 'Email is too long')
    .optional()
    .transform((value) => (value && value.length > 0 ? value.toLowerCase() : undefined))
    .refine((value) => value === undefined || z.email().safeParse(value).success, {
      message: 'Enter a valid email address',
    }),
  groupId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  side: optionalEnum(guestSides),
  guestType: optionalEnum(guestTypes),
  plusOneAllowed: z.boolean().default(false),
  dietaryNotes: optionalText(500, 'Dietary notes are too long'),
  notes: optionalText(1000, 'Notes are too long'),
});

export type GuestFormValues = z.infer<typeof guestFormSchema>;

export const groupFormSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required').max(80, 'Name is too long'),
  side: optionalEnum(guestSides),
  notes: optionalText(500, 'Notes are too long'),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;

export const designFormSchema = z.object({
  name: z.string().trim().min(1, 'Design name is required').max(80, 'Name is too long'),
  title: optionalText(120, 'Title is too long'),
  message: optionalText(600, 'Message is too long'),
  accent: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => value === undefined || HEX_COLOR.test(value), {
      message: 'Use a hex colour such as #C5A36A',
    }),
  layout: z.enum(designLayouts).default('classic'),
});

export type DesignFormValues = z.infer<typeof designFormSchema>;

export const eventFormSchema = z.object({
  name: z.string().trim().min(1, 'Event name is required').max(120, 'Name is too long'),
  eventType: z.enum(eventTypes).default('ceremony'),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

export const rsvpSchema = z.object({
  guestId: z.string().uuid(),
  eventId: z.string().uuid(),
  response: z.enum(rsvpResponses),
});

export type RsvpValues = z.infer<typeof rsvpSchema>;

export const tableFormSchema = z.object({
  name: z.string().trim().min(1, 'Table name is required').max(60, 'Name is too long'),
  capacity: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 1000),
      { message: 'Capacity must be a whole number from 1 to 1000' },
    )
    .transform((value) => (value ? Number(value) : undefined)),
});

export type TableFormValues = z.infer<typeof tableFormSchema>;

export const createInvitationSchema = z
  .object({
    guestId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    designId: z.string().uuid().optional(),
    eventIds: z.array(z.string().uuid()).default([]),
  })
  .refine((value) => Boolean(value.guestId) !== Boolean(value.groupId), {
    message: 'Choose either a guest or a group',
    path: ['guestId'],
  });

export type CreateInvitationValues = z.infer<typeof createInvitationSchema>;

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
