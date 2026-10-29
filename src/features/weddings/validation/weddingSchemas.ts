import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const createWeddingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Wedding title is required')
    .max(120, 'Title is too long'),
  partnerOneName: z
    .string()
    .trim()
    .min(1, 'Partner one name is required')
    .max(80, 'Name is too long'),
  partnerTwoName: z
    .string()
    .trim()
    .min(1, 'Partner two name is required')
    .max(80, 'Name is too long'),
  weddingDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => value === undefined || ISO_DATE.test(value), {
      message: 'Use date format YYYY-MM-DD',
    }),
  city: optionalTrimmed,
  style: z.enum(['traditional', 'modern', 'blend']).optional(),
});

export const createWeddingBasicsSchema = createWeddingSchema.pick({
  partnerOneName: true,
  partnerTwoName: true,
  title: true,
});

export const createWeddingDetailsSchema = createWeddingSchema.pick({
  weddingDate: true,
  city: true,
  style: true,
});

export type CreateWeddingFormValues = z.infer<typeof createWeddingSchema>;

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

export function defaultWeddingTitle(partnerOne: string, partnerTwo: string): string {
  const a = partnerOne.trim();
  const b = partnerTwo.trim();
  if (a && b) return `${a} & ${b}`;
  return a || b || 'Our Wedding';
}

export function isPastIsoDate(isoDate: string): boolean {
  if (!ISO_DATE.test(isoDate)) return false;
  const today = new Date();
  const todayIso = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  return isoDate < todayIso;
}
