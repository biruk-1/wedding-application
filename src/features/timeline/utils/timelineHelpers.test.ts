import { describe, expect, it } from 'vitest';

import type { WeddingEvent } from '@/features/timeline/types';
import {
  buildCalendarDays,
  eventDateKeys,
  eventsOnDate,
  filterEvents,
  findOverlappingItems,
  intervalsOverlap,
  nextUpcomingEvent,
  sortEventsChronologically,
} from '@/features/timeline/utils/timelineHelpers';

function event(partial: Partial<WeddingEvent> & { id: string; name: string }): WeddingEvent {
  return {
    wedding_id: 'w',
    event_type: 'ceremony',
    starts_at: null,
    ends_at: null,
    venue_name: null,
    address: null,
    city: null,
    notes: null,
    sort_order: 0,
    ...partial,
  };
}

describe('timelineHelpers', () => {
  const events = [
    event({ id: '1', name: 'Past', starts_at: '2020-01-01T10:00:00.000Z', ends_at: '2020-01-01T12:00:00.000Z' }),
    event({ id: '2', name: 'Soon', starts_at: '2099-06-01T08:00:00.000Z' }),
    event({ id: '3', name: 'TBD' }),
  ];

  it('sorts chronologically with undated last among timed peers via nulls', () => {
    const sorted = sortEventsChronologically(events);
    expect(sorted.map((e) => e.id)).toEqual(['1', '2', '3']);
  });

  it('filters upcoming and past', () => {
    expect(filterEvents(events, 'past', 'Africa/Addis_Ababa').map((e) => e.id)).toEqual(['1']);
    expect(filterEvents(events, 'upcoming', 'Africa/Addis_Ababa').map((e) => e.id)).toEqual(['2', '3']);
  });

  it('finds the next upcoming event', () => {
    expect(nextUpcomingEvent(events)?.id).toBe('2');
  });

  it('groups events by wedding-local date', () => {
    // 07:00Z = 10:00 Addis on 2026-08-15
    const dayEvents = [
      event({ id: 'a', name: 'A', starts_at: '2026-08-15T07:00:00.000Z' }),
      event({ id: 'b', name: 'B', starts_at: '2026-08-16T07:00:00.000Z' }),
    ];
    expect(eventsOnDate(dayEvents, '2026-08-15', 'Africa/Addis_Ababa').map((e) => e.id)).toEqual(['a']);
    expect(eventDateKeys(dayEvents, 'Africa/Addis_Ababa').has('2026-08-15')).toBe(true);
  });

  it('builds a calendar grid with event markers', () => {
    const keys = new Set(['2026-08-15']);
    const days = buildCalendarDays('2026-08', keys, 'Africa/Addis_Ababa');
    expect(days.length % 7).toBe(0);
    expect(days.some((d) => d.dateKey === '2026-08-15' && d.hasEvents && d.inCurrentMonth)).toBe(true);
  });

  it('detects overlapping schedule items', () => {
    expect(
      intervalsOverlap(
        '2026-08-15T08:00:00.000Z',
        '2026-08-15T09:00:00.000Z',
        '2026-08-15T08:30:00.000Z',
        '2026-08-15T09:30:00.000Z',
      ),
    ).toBe(true);
    expect(
      intervalsOverlap(
        '2026-08-15T08:00:00.000Z',
        '2026-08-15T09:00:00.000Z',
        '2026-08-15T09:00:00.000Z',
        '2026-08-15T10:00:00.000Z',
      ),
    ).toBe(false);

    const overlaps = findOverlappingItems(
      [
        { id: '1', title: 'Makeup', starts_at: '2026-08-15T08:00:00.000Z', ends_at: '2026-08-15T09:00:00.000Z' },
        { id: '2', title: 'Photos', starts_at: '2026-08-15T09:00:00.000Z', ends_at: '2026-08-15T10:00:00.000Z' },
      ],
      { startsAt: '2026-08-15T08:30:00.000Z', endsAt: '2026-08-15T08:45:00.000Z' },
    );
    expect(overlaps.map((o) => o.id)).toEqual(['1']);
  });
});
