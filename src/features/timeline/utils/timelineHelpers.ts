import type { CalendarDay, EventFilter, TimelineItem, WeddingEvent } from '@/features/timeline/types';
import {
  addMonths,
  monthKeyFromDateKey,
  todayDateKey,
  zonedParts,
} from '@/features/timeline/utils/datetime';

export function sortEventsChronologically(events: WeddingEvent[]): WeddingEvent[] {
  return [...events].sort((a, b) => {
    if (a.starts_at && b.starts_at) {
      const diff = a.starts_at.localeCompare(b.starts_at);
      if (diff !== 0) return diff;
    } else if (a.starts_at) return -1;
    else if (b.starts_at) return 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

export function filterEvents(
  events: WeddingEvent[],
  filter: EventFilter,
  timeZone: string,
  now = new Date(),
): WeddingEvent[] {
  const sorted = sortEventsChronologically(events);
  if (filter === 'all') return sorted;
  const nowMs = now.getTime();
  return sorted.filter((event) => {
    if (!event.starts_at) return filter === 'upcoming';
    const start = new Date(event.starts_at).getTime();
    const end = event.ends_at ? new Date(event.ends_at).getTime() : start;
    if (filter === 'upcoming') return end >= nowMs;
    return end < nowMs;
  });
}

export function nextUpcomingEvent(
  events: WeddingEvent[],
  now = new Date(),
): WeddingEvent | null {
  const nowMs = now.getTime();
  return (
    sortEventsChronologically(events).find((event) => {
      if (!event.starts_at) return true;
      const end = event.ends_at ? new Date(event.ends_at).getTime() : new Date(event.starts_at).getTime();
      return end >= nowMs;
    }) ?? null
  );
}

export function eventsOnDate(
  events: WeddingEvent[],
  dateKey: string,
  timeZone: string,
): WeddingEvent[] {
  return sortEventsChronologically(events).filter((event) => {
    if (!event.starts_at) return false;
    return zonedParts(event.starts_at, timeZone)?.dateKey === dateKey;
  });
}

export function eventDateKeys(events: WeddingEvent[], timeZone: string): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    if (!event.starts_at) continue;
    const key = zonedParts(event.starts_at, timeZone)?.dateKey;
    if (key) keys.add(key);
  }
  return keys;
}

/** Build a Sunday-first calendar grid for a YYYY-MM month key. */
export function buildCalendarDays(
  monthKey: string,
  eventKeys: Set<string>,
  timeZone: string,
): CalendarDay[] {
  const [year, month] = monthKey.split('-').map(Number);
  const firstUtc = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  // Weekday in the wedding TZ for the 1st
  const firstParts = zonedParts(firstUtc, timeZone);
  const firstWeekday = firstParts
    ? new Date(`${firstParts.dateKey}T12:00:00Z`).getUTCDay()
    : firstUtc.getUTCDay();

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonthKey = addMonths(monthKey, -1);
  const [py, pm] = prevMonthKey.split('-').map(Number);
  const daysInPrev = new Date(Date.UTC(py, pm, 0)).getUTCDate();

  const cells: CalendarDay[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const day = daysInPrev - firstWeekday + i + 1;
    const dateKey = `${prevMonthKey}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      dayOfMonth: day,
      inCurrentMonth: false,
      hasEvents: eventKeys.has(dateKey),
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      dayOfMonth: day,
      inCurrentMonth: true,
      hasEvents: eventKeys.has(dateKey),
    });
  }

  while (cells.length % 7 !== 0) {
    const day = cells.length - (firstWeekday + daysInMonth) + 1;
    const nextKey = addMonths(monthKey, 1);
    const dateKey = `${nextKey}-${String(day).padStart(2, '0')}`;
    cells.push({
      dateKey,
      dayOfMonth: day,
      inCurrentMonth: false,
      hasEvents: eventKeys.has(dateKey),
    });
  }

  return cells;
}

export function defaultMonthKey(events: WeddingEvent[], timeZone: string, now = new Date()): string {
  const next = nextUpcomingEvent(events, now);
  if (next?.starts_at) {
    const key = zonedParts(next.starts_at, timeZone)?.dateKey;
    if (key) return monthKeyFromDateKey(key);
  }
  return monthKeyFromDateKey(todayDateKey(timeZone, now));
}

export function sortTimelineItems<T extends TimelineItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.starts_at && b.starts_at) {
      const diff = a.starts_at.localeCompare(b.starts_at);
      if (diff !== 0) return diff;
    } else if (a.starts_at) return -1;
    else if (b.starts_at) return 1;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

/** True when two timed intervals overlap (touching endpoints is OK). */
export function intervalsOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  if (!aStart || !bStart) return false;
  const as = new Date(aStart).getTime();
  const ae = aEnd ? new Date(aEnd).getTime() : as;
  const bs = new Date(bStart).getTime();
  const be = bEnd ? new Date(bEnd).getTime() : bs;
  if (Number.isNaN(as) || Number.isNaN(ae) || Number.isNaN(bs) || Number.isNaN(be)) return false;
  return as < be && bs < ae;
}

export function findOverlappingItems(
  items: Pick<TimelineItem, 'id' | 'title' | 'starts_at' | 'ends_at'>[],
  candidate: { id?: string; startsAt?: string | null; endsAt?: string | null },
): { id: string; title: string }[] {
  if (!candidate.startsAt) return [];
  return items
    .filter((item) => item.id !== candidate.id)
    .filter((item) =>
      intervalsOverlap(candidate.startsAt ?? null, candidate.endsAt ?? null, item.starts_at, item.ends_at),
    )
    .map((item) => ({ id: item.id, title: item.title }));
}

export function locationLabel(event: Pick<WeddingEvent, 'venue_name' | 'address' | 'city'>): string | null {
  const parts = [event.venue_name, event.address, event.city].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function eventTypeLabel(type: string): string {
  return type.replace(/_/g, ' ');
}
