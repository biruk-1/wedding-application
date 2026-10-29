import { z } from 'zod';

export const inquiryFormSchema = z.object({
  message: z
    .string()
    .trim()
    .min(10, 'Please share a bit more detail (at least 10 characters)')
    .max(2000, 'Message is too long'),
  serviceId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : undefined)),
  proposedBudget: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine((value) => value === undefined || /^\d+(\.\d{1,2})?$/.test(value), {
      message: 'Enter a valid budget amount',
    })
    .transform((value) => (value === undefined ? undefined : Number(value))),
});

export type InquiryFormValues = z.infer<typeof inquiryFormSchema>;

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
