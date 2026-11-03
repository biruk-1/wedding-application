import { describe, expect, it } from 'vitest';

import { normalizeWeddingStyle } from '@/theme/weddingStyleIds';

describe('normalizeWeddingStyle', () => {
  it('maps onboarding values to theme ids', () => {
    expect(normalizeWeddingStyle('modern')).toBe('modern');
    expect(normalizeWeddingStyle('traditional')).toBe('traditional');
    expect(normalizeWeddingStyle('blend')).toBe('blend');
    expect(normalizeWeddingStyle('fusion')).toBe('blend');
  });

  it('defaults unknown or empty values to modern', () => {
    expect(normalizeWeddingStyle(null)).toBe('modern');
    expect(normalizeWeddingStyle('')).toBe('modern');
    expect(normalizeWeddingStyle('unknown')).toBe('modern');
  });
});
