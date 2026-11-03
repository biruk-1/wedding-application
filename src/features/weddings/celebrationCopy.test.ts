import { describe, expect, it } from 'vitest';

import {
  CELEBRATION_COPY,
  getCelebrationCopy,
  normalizeCelebrationKind,
} from './celebrationCopy';
import type { CelebrationKind } from './types';

const KINDS: CelebrationKind[] = [
  'wedding',
  'shemgelena',
  'qelekel',
  'baby_shower',
  'birthday',
  'anniversary',
  'graduation',
  'other',
];

describe('celebration copy', () => {
  it('defines copy and real module capabilities for all celebration kinds', () => {
    expect(Object.keys(CELEBRATION_COPY)).toEqual(KINDS);

    for (const kind of KINDS) {
      const copy = getCelebrationCopy(kind);
      expect(copy.kind).toBe(kind);
      expect(copy.label).not.toBe('');
      expect(copy.progressLabel).not.toBe('');
      expect(Object.values(copy.capabilities).every(Boolean)).toBe(true);
    }
  });

  it('preserves the existing wedding copy', () => {
    expect(getCelebrationCopy('wedding')).toMatchObject({
      progressLabel: 'Wedding progress',
      countdownAccessibilityLabel: 'Wedding countdown',
      pastDateLabel: 'Since your wedding day',
      unavailableLabel: 'Wedding unavailable.',
      successTitle: 'Wedding created',
      successBody:
        'Your wedding space is ready. You are the owner and can invite partners later.',
    });
  });

  it.each(KINDS.filter((kind) => kind !== 'wedding'))(
    'keeps wedding and partner language out of %s copy',
    (kind) => {
      const serialized = JSON.stringify(getCelebrationCopy(kind)).toLowerCase();
      expect(serialized).not.toContain('wedding');
      expect(serialized).not.toContain('bride');
      expect(serialized).not.toContain('groom');
      expect(serialized).not.toContain('partner');
    },
  );

  it('falls back safely for missing or unknown database values', () => {
    expect(normalizeCelebrationKind(undefined)).toBe('wedding');
    expect(normalizeCelebrationKind('unknown')).toBe('wedding');
    expect(getCelebrationCopy(null)).toBe(CELEBRATION_COPY.wedding);
  });
});
