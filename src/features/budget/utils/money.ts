/**
 * Decimal-safe money helpers for numeric(14,2) amounts.
 * All arithmetic goes through integer minor units (cents) to avoid float drift.
 */

const SCALE = 100;
const MAX_MAJOR = 999_999_999_999.99;

/** Convert a major-unit amount to integer minor units (cents). */
export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * SCALE);
}

/** Convert integer minor units back to a major-unit number. */
export function fromMinor(minor: number): number {
  return minor / SCALE;
}

export function addMoney(...amounts: number[]): number {
  return fromMinor(amounts.reduce((sum, amount) => sum + toMinor(amount), 0));
}

export function subMoney(left: number, right: number): number {
  return fromMinor(toMinor(left) - toMinor(right));
}

export function maxMoney(left: number, right: number): number {
  return fromMinor(Math.max(toMinor(left), toMinor(right)));
}

export function minMoney(left: number, right: number): number {
  return fromMinor(Math.min(toMinor(left), toMinor(right)));
}

export function moneyEquals(left: number, right: number): boolean {
  return toMinor(left) === toMinor(right);
}

export function moneyGreater(left: number, right: number): boolean {
  return toMinor(left) > toMinor(right);
}

/** Clamp a non-negative money value into the schema range. */
export function clampMoney(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (amount > MAX_MAJOR) return MAX_MAJOR;
  return fromMinor(toMinor(amount));
}

/**
 * Parse a user-entered money string into a finite major-unit number, or null if invalid.
 * Accepts "1200", "1,200.50", "1200.5".
 */
export function parseMoneyInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MAJOR) return null;
  return fromMinor(toMinor(value));
}

export function formatMoney(amount: number | null | undefined, currencyCode = 'ETB'): string {
  if (amount == null || Number.isNaN(amount)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(0);
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: toMinor(amount) % SCALE === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return '0%';
  const pct = Math.round(ratio * 1000) / 10; // one decimal
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}
