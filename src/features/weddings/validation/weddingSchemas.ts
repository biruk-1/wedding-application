import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidOptionalIsoDate(value: string | undefined): boolean {
  if (value === undefined) return true;
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const optionalTrimmed = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const celebrationKindSchema = z.enum([
  'wedding',
  'shemgelena',
  'qelekel',
  'baby_shower',
  'birthday',
  'anniversary',
  'graduation',
  'other',
]);

export const createCelebrationTypeSchema = z.object({
  celebrationKind: celebrationKindSchema,
});

export const createWeddingDetailsSchema = z
  .object({
    celebrationKind: celebrationKindSchema,
    title: z.string().trim().min(1, 'Event title is required').max(120, 'Title is too long'),
    partnerOneName: optionalTrimmed.pipe(z.string().max(80, 'Name is too long').optional()),
    partnerTwoName: optionalTrimmed.pipe(z.string().max(80, 'Name is too long').optional()),
    weddingDate: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : undefined))
      .refine(isValidOptionalIsoDate, { message: 'Use a valid date in YYYY-MM-DD format' }),
    city: optionalTrimmed,
    estimatedGuestCount: z
      .number({ error: 'Enter a valid guest count' })
      .int('Guest count must be a whole number')
      .nonnegative('Guest count cannot be negative')
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.celebrationKind !== 'wedding') return;
    if (!value.partnerOneName) {
      context.addIssue({
        code: 'custom',
        path: ['partnerOneName'],
        message: 'Partner one name is required',
      });
    }
    if (!value.partnerTwoName) {
      context.addIssue({
        code: 'custom',
        path: ['partnerTwoName'],
        message: 'Partner two name is required',
      });
    }
  });

export const createWeddingStyleSchema = z.object({
  style: z.enum(['traditional', 'modern', 'blend']),
});

export const createWeddingBudgetSchema = z
  .object({
    totalBudget: z
      .number({ error: 'Enter a valid total budget' })
      .finite()
      .nonnegative('Total budget cannot be negative'),
    budgetAllocations: z.array(
      z.object({
        categorySlug: z.string().trim().min(1, 'Budget category is required'),
        amount: z
          .number({ error: 'Enter a valid allocation' })
          .finite()
          .nonnegative('Allocation cannot be negative'),
      }),
    ),
  })
  .superRefine((value, context) => {
    const allocated = value.budgetAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (allocated > value.totalBudget) {
      context.addIssue({
        code: 'custom',
        path: ['budgetAllocations'],
        message: 'Allocated budget cannot exceed the total budget',
      });
    }
  });

const createWeddingBaseSchema = z.object({
  celebrationKind: celebrationKindSchema,
  title: z
    .string()
    .trim()
    .min(1, 'Event title is required')
    .max(120, 'Title is too long'),
  partnerOneName: optionalTrimmed.pipe(z.string().max(80, 'Name is too long').optional()),
  partnerTwoName: optionalTrimmed.pipe(z.string().max(80, 'Name is too long').optional()),
  weddingDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(isValidOptionalIsoDate, {
      message: 'Use a valid date in YYYY-MM-DD format',
    }),
  city: optionalTrimmed,
  style: z.enum(['traditional', 'modern', 'blend']),
  estimatedGuestCount: z.number().int().nonnegative().optional(),
  totalBudget: z.number().finite().nonnegative(),
  budgetAllocations: z.array(
    z.object({
      categorySlug: z.string().trim().min(1),
      amount: z.number().finite().nonnegative(),
    }),
  ),
});

export const createWeddingSchema = createWeddingBaseSchema.superRefine((value, context) => {
  if (value.celebrationKind === 'wedding') {
    if (!value.partnerOneName) {
      context.addIssue({
        code: 'custom',
        path: ['partnerOneName'],
        message: 'Partner one name is required',
      });
    }
    if (!value.partnerTwoName) {
      context.addIssue({
        code: 'custom',
        path: ['partnerTwoName'],
        message: 'Partner two name is required',
      });
    }
  }
  const allocated = value.budgetAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (allocated > value.totalBudget) {
    context.addIssue({
      code: 'custom',
      path: ['budgetAllocations'],
      message: 'Allocated budget cannot exceed the total budget',
    });
  }
});

export const createWeddingBasicsSchema = createWeddingDetailsSchema;

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
  const first = partnerOne.trim();
  const second = partnerTwo.trim();
  if (first && second) return `${first} & ${second}`;
  return first || second || 'Our Wedding';
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
