/** Local-calendar YYYY-MM-DD helpers (avoid UTC day-shift). */

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso || !isIsoDate(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function isoDateFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TIME_HM = /^\d{2}:\d{2}$/;

export function isTimeHm(value: string): boolean {
  return TIME_HM.test(value);
}

export function parseTimeHm(hm: string | null | undefined): Date | null {
  if (!hm || !TIME_HM.test(hm)) return null;
  const [hours, minutes] = hm.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function timeHmFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function todayIsoDate(now = new Date()): string {
  return isoDateFromDate(now);
}
