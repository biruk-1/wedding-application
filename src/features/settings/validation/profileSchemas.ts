import { z } from 'zod';

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter your display name')
    .max(80, 'Keep your name under 80 characters'),
  phone: z.string().trim().max(30, 'Phone number is too long'),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match',
      });
    }
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
