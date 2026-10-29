import { describe, expect, it } from 'vitest';

import {
  fieldErrorsFromZod,
  inquiryFormSchema,
} from '@/features/vendors/validation/inquirySchemas';

describe('inquiryFormSchema', () => {
  it('requires a meaningful message', () => {
    const short = inquiryFormSchema.safeParse({ message: 'hi' });
    expect(short.success).toBe(false);
    if (!short.success) {
      expect(fieldErrorsFromZod(short.error).message).toMatch(/10 characters/i);
    }
  });

  it('accepts optional service and budget', () => {
    const ok = inquiryFormSchema.safeParse({
      message: 'We are planning a garden wedding in October for about 120 guests.',
      serviceId: '',
      proposedBudget: '50000',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.serviceId).toBeUndefined();
      expect(ok.data.proposedBudget).toBe(50000);
    }
  });

  it('rejects invalid budget strings', () => {
    const bad = inquiryFormSchema.safeParse({
      message: 'Looking for full-day photography coverage for our ceremony.',
      proposedBudget: 'abc',
    });
    expect(bad.success).toBe(false);
  });
});
