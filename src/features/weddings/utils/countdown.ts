export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
};

/** Countdown from local midnight-aware ISO date (YYYY-MM-DD) to now. */
export function getCountdownParts(isoDate: string, now = new Date()): CountdownParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;

  const [year, month, day] = isoDate.split('-').map(Number);
  const target = new Date(year, month - 1, day, 0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const abs = Math.abs(diffMs);

  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((abs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, isPast };
}

export function formatWeddingDateLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
