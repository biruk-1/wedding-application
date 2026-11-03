import { describe, expect, it } from 'vitest';

import {
  createWeddingBudgetSchema,
  createWeddingDetailsSchema,
  createWeddingSchema,
  defaultWeddingTitle,
  fieldErrorsFromZod,
  isPastIsoDate,
} from './weddingSchemas';

describe('createWeddingSchema', () => {
  const celebrationKinds = [
    'wedding',
    'shemgelena',
    'qelekel',
    'baby_shower',
    'birthday',
    'anniversary',
    'graduation',
    'other',
  ] as const;
  const validBase = {
    weddingDate: '2026-08-15',
    city: 'Addis Ababa',
    style: 'traditional' as const,
    estimatedGuestCount: 250,
    totalBudget: 10_000,
    budgetAllocations: [{ categorySlug: 'venue', amount: 4_000 }],
  };

  it.each(celebrationKinds)('accepts the %s celebration kind', (kind) => {
    const result = createWeddingSchema.safeParse({
      ...validBase,
      celebrationKind: kind,
      title: kind === 'other' ? 'Community fundraiser' : 'Celebration',
      partnerOneName: kind === 'wedding' ? 'Hana' : undefined,
      partnerTwoName: kind === 'wedding' ? 'Daniel' : undefined,
    });
    expect(result.success).toBe(true);
  });

  it('requires both partner names for weddings', () => {
    const result = createWeddingSchema.safeParse({
      ...validBase,
      celebrationKind: 'wedding',
      title: 'Hana & Daniel',
      partnerOneName: '',
      partnerTwoName: 'Daniel',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsFromZod(result.error);
      expect(errors.partnerOneName).toBeTruthy();
    }
  });

  it('does not require partner names for non-weddings', () => {
    const result = createWeddingDetailsSchema.safeParse({
      celebrationKind: 'birthday',
      title: 'Mimi turns 30',
    });
    expect(result.success).toBe(true);
  });

  it.each(['', '   '])('requires a custom title for Other (%j)', (title) => {
    const result = createWeddingDetailsSchema.safeParse({
      celebrationKind: 'other',
      title,
    });
    expect(result.success).toBe(false);
  });

  it.each(['Aug 15, 2026', '2026-99-99'])('rejects invalid date %s', (weddingDate) => {
    const result = createWeddingDetailsSchema.safeParse({
      celebrationKind: 'birthday',
      title: 'Birthday',
      weddingDate,
    });
    expect(result.success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN])('rejects invalid guest count %s', (estimatedGuestCount) => {
    const result = createWeddingDetailsSchema.safeParse({
      celebrationKind: 'graduation',
      title: 'Graduation',
      estimatedGuestCount,
    });
    expect(result.success).toBe(false);
  });
});

describe('createWeddingBudgetSchema', () => {
  it('accepts nonnegative allocations within the total', () => {
    expect(
      createWeddingBudgetSchema.safeParse({
        totalBudget: 10_000,
        budgetAllocations: [
          { categorySlug: 'venue', amount: 6_000 },
          { categorySlug: 'food', amount: 4_000 },
        ],
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      totalBudget: -1,
      budgetAllocations: [],
    },
    {
      totalBudget: 100,
      budgetAllocations: [{ categorySlug: 'venue', amount: -1 }],
    },
    {
      totalBudget: 100,
      budgetAllocations: [{ categorySlug: 'venue', amount: 101 }],
    },
    {
      totalBudget: Number.NaN,
      budgetAllocations: [],
    },
  ])('rejects invalid budget input %#', (input) => {
    expect(createWeddingBudgetSchema.safeParse(input).success).toBe(false);
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
