/**
 * Timezone-aware formatting and parsing for wedding schedules.
 * Default wedding timezone is Africa/Addis_Ababa (UTC+3, no DST).
 */

export const DEFAULT_WEDDING_TIMEZONE = 'Africa/Addis_Ababa';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM = /^\d{2}:\d{2}$/;

export function isDateKey(value: string): boolean {
  return DATE_KEY.test(value);
}

export function isTimeHm(value: string): boolean {
  if (!TIME_HM.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Parts of an instant as seen in `timeZone`. */
export function zonedParts(
  iso: string | Date,
  timeZone: string = DEFAULT_WEDDING_TIMEZONE,
): { dateKey: string; timeHm: string; weekday: string } | null {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    }).formatToParts(date);

    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? '';

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour').padStart(2, '0');
    const minute = get('minute').padStart(2, '0');

    return {
      dateKey: `${year}-${month}-${day}`,
      timeHm: `${hour}:${minute}`,
      weekday: get('weekday'),
    };
  } catch {
    return null;
  }
}

/**
 * Convert a wedding-local date + time into a UTC ISO string.
 * Uses iterative correction so IANA zones (including Addis Ababa) stay accurate.
 */
export function zonedLocalToIso(
  dateKey: string,
  timeHm: string,
  timeZone: string = DEFAULT_WEDDING_TIMEZONE,
): string | null {
  if (!isDateKey(dateKey) || !isTimeHm(timeHm)) return null;

  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = timeHm.split(':').map(Number);

  // First guess: treat the local wall time as UTC, then correct.
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(new Date(utc), timeZone);
    if (!parts) return null;
    const [py, pm, pd] = parts.dateKey.split('-').map(Number);
    const [ph, pmin] = parts.timeHm.split(':').map(Number);
    const asUtc = Date.UTC(py, pm - 1, pd, ph, pmin, 0, 0);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const delta = wanted - asUtc;
    if (delta === 0) break;
    utc += delta;
  }

  return new Date(utc).toISOString();
}

export function formatEventWhen(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone: string = DEFAULT_WEDDING_TIMEZONE,
): string {
  if (!startsAt) return 'Date TBD';
  const start = zonedParts(startsAt, timeZone);
  if (!start) return 'Date TBD';

  const startLabel = `${start.weekday}, ${start.dateKey} · ${start.timeHm}`;
  if (!endsAt) return startLabel;

  const end = zonedParts(endsAt, timeZone);
  if (!end) return startLabel;
  if (end.dateKey === start.dateKey) return `${startLabel} – ${end.timeHm}`;
  return `${startLabel} → ${end.weekday}, ${end.dateKey} · ${end.timeHm}`;
}

export function formatTimeRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone: string = DEFAULT_WEDDING_TIMEZONE,
): string {
  if (!startsAt) return 'Time TBD';
  const start = zonedParts(startsAt, timeZone);
  if (!start) return 'Time TBD';
  if (!endsAt) return start.timeHm;
  const end = zonedParts(endsAt, timeZone);
  if (!end) return start.timeHm;
  return `${start.timeHm} – ${end.timeHm}`;
}

export function monthKeyFromDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey: string, timeZone: string = DEFAULT_WEDDING_TIMEZONE): string {
  const [y, m] = monthKey.split('-').map(Number);
  // Noon UTC on the 15th avoids month-edge TZ shifts for labels.
  const probe = new Date(Date.UTC(y, m - 1, 15, 12, 0, 0));
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      month: 'long',
      year: 'numeric',
    }).format(probe);
  } catch {
    return monthKey;
  }
}

/** Today's YYYY-MM-DD in the wedding timezone. */
export function todayDateKey(timeZone: string = DEFAULT_WEDDING_TIMEZONE, now = new Date()): string {
  return zonedParts(now, timeZone)?.dateKey ?? now.toISOString().slice(0, 10);
}
