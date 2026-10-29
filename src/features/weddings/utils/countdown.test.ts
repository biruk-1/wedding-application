import { describe, expect, it } from 'vitest';

import { formatWeddingDateLabel, getCountdownParts } from './countdown';

describe('getCountdownParts', () => {
  it('returns null for invalid dates', () => {
    expect(getCountdownParts('nope')).toBeNull();
  });

  it('computes a future countdown', () => {
    const now = new Date(2026, 0, 1, 12, 0, 0);
    const parts = getCountdownParts('2026-01-03', now);
    expect(parts?.isPast).toBe(false);
    expect(parts?.days).toBe(1);
  });

  it('flags past dates', () => {
    const now = new Date(2026, 5, 1);
    const parts = getCountdownParts('2026-01-01', now);
    expect(parts?.isPast).toBe(true);
  });
});

describe('formatWeddingDateLabel', () => {
  it('formats ISO dates', () => {
    expect(formatWeddingDateLabel('2026-08-15')).toMatch(/2026/);
  });

  it('returns null for empty', () => {
    expect(formatWeddingDateLabel(null)).toBeNull();
  });
});
