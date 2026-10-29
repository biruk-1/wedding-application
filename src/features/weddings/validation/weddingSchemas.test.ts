import { describe, expect, it } from 'vitest';

import {
  createWeddingSchema,
  defaultWeddingTitle,
  fieldErrorsFromZod,
  isPastIsoDate,
} from './weddingSchemas';

describe('createWeddingSchema', () => {
  it('requires partner names and title', () => {
    const result = createWeddingSchema.safeParse({
      title: '',
      partnerOneName: '',
      partnerTwoName: 'Daniel',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsFromZod(result.error);
      expect(errors.title || errors.partnerOneName).toBeTruthy();
    }
  });

  it('accepts a complete payload', () => {
    const result = createWeddingSchema.safeParse({
      title: 'Hana & Daniel',
      partnerOneName: 'Hana',
      partnerTwoName: 'Daniel',
      weddingDate: '2026-08-15',
      city: 'Addis Ababa',
      style: 'traditional',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = createWeddingSchema.safeParse({
      title: 'Hana & Daniel',
      partnerOneName: 'Hana',
      partnerTwoName: 'Daniel',
      weddingDate: 'Aug 15, 2026',
    });
    expect(result.success).toBe(false);
  });
});

describe('defaultWeddingTitle', () => {
  it('joins partner names', () => {
    expect(defaultWeddingTitle('Hana', 'Daniel')).toBe('Hana & Daniel');
  });
});

describe('isPastIsoDate', () => {
  it('detects past dates', () => {
    expect(isPastIsoDate('2000-01-01')).toBe(true);
    expect(isPastIsoDate('2099-01-01')).toBe(false);
  });
});
