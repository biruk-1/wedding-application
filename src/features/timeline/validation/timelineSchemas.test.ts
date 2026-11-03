import { describe, expect, it } from 'vitest';

import { eventFormSchema, timelineItemFormSchema } from '@/features/timeline/validation/timelineSchemas';

describe('timelineSchemas', () => {
  it('accepts a dated event', () => {
    const parsed = eventFormSchema.safeParse({
      name: 'Ceremony',
      eventType: 'ceremony',
      startDate: '2026-08-15',
      startTime: '10:00',
      endDate: '2026-08-15',
      endTime: '12:00',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid date/time formats', () => {
    expect(
      eventFormSchema.safeParse({
        name: 'Ceremony',
        eventType: 'ceremony',
        startDate: '15/08/2026',
        startTime: '10:00',
      }).success,
    ).toBe(false);
    expect(
      timelineItemFormSchema.safeParse({
        title: 'Makeup',
        startDate: '2026-08-15',
        startTime: '9:00',
      }).success,
    ).toBe(false);
  });

  it('requires a start date when a start time is set', () => {
    const parsed = eventFormSchema.safeParse({
      name: 'Photos',
      eventType: 'photography',
      startTime: '09:00',
    });
    expect(parsed.success).toBe(false);
  });
});
