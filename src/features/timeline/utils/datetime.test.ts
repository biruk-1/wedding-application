import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WEDDING_TIMEZONE,
  addMonths,
  formatEventWhen,
  isDateKey,
  isTimeHm,
  todayDateKey,
  zonedLocalToIso,
  zonedParts,
} from '@/features/timeline/utils/datetime';

describe('datetime helpers', () => {
  it('validates date and time keys', () => {
    expect(isDateKey('2026-08-15')).toBe(true);
    expect(isDateKey('2026-8-15')).toBe(false);
    expect(isTimeHm('09:30')).toBe(true);
    expect(isTimeHm('9:30')).toBe(false);
    expect(isTimeHm('24:00')).toBe(false);
  });

  it('round-trips Addis Ababa local time to UTC', () => {
    const iso = zonedLocalToIso('2026-08-15', '10:00', DEFAULT_WEDDING_TIMEZONE);
    expect(iso).toBeTruthy();
    const parts = zonedParts(iso!, DEFAULT_WEDDING_TIMEZONE);
    expect(parts?.dateKey).toBe('2026-08-15');
    expect(parts?.timeHm).toBe('10:00');
    // Addis is UTC+3 → 07:00Z
    expect(iso).toBe('2026-08-15T07:00:00.000Z');
  });

  it('formats event windows without shifting the calendar day', () => {
    const label = formatEventWhen(
      '2026-08-15T07:00:00.000Z',
      '2026-08-15T10:00:00.000Z',
      DEFAULT_WEDDING_TIMEZONE,
    );
    expect(label).toContain('2026-08-15');
    expect(label).toContain('10:00');
    expect(label).toContain('13:00');
  });

  it('adds months and reports today', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(todayDateKey(DEFAULT_WEDDING_TIMEZONE)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
