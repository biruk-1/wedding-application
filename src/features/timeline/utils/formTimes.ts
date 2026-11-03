import type { EventFormValues, TimelineItemFormValues } from '@/features/timeline/validation/timelineSchemas';
import { zonedLocalToIso, zonedParts } from '@/features/timeline/utils/datetime';

function combine(
  dateKey: string | null | undefined,
  timeHm: string | null | undefined,
  timeZone: string,
): string | null {
  if (!dateKey) return null;
  return zonedLocalToIso(dateKey, timeHm ?? '00:00', timeZone);
}

export function eventFormToTimestamps(
  values: EventFormValues,
  timeZone: string,
): { startsAt: string | null; endsAt: string | null; error?: string } {
  const startsAt = combine(values.startDate, values.startTime, timeZone);
  const endDate = values.endDate ?? values.startDate;
  const endsAt =
    values.endDate || values.endTime ? combine(endDate, values.endTime ?? values.startTime ?? '00:00', timeZone) : null;

  if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    return { startsAt, endsAt, error: 'End must be on or after the start' };
  }
  return { startsAt, endsAt };
}

export function timelineFormToTimestamps(
  values: TimelineItemFormValues,
  timeZone: string,
): { startsAt: string | null; endsAt: string | null; error?: string } {
  const startsAt = combine(values.startDate, values.startTime, timeZone);
  const endDate = values.endDate ?? values.startDate;
  const endsAt =
    values.endDate || values.endTime
      ? combine(endDate, values.endTime ?? values.startTime ?? '00:00', timeZone)
      : null;

  if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    return { startsAt, endsAt, error: 'End must be on or after the start' };
  }
  return { startsAt, endsAt };
}

export function splitTimestamp(
  iso: string | null | undefined,
  timeZone: string,
): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const parts = zonedParts(iso, timeZone);
  if (!parts) return { date: '', time: '' };
  return { date: parts.dateKey, time: parts.timeHm };
}
