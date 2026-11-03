import { describe, expect, it } from 'vitest';

import {
  addMoney,
  clampMoney,
  formatMoney,
  formatPercent,
  fromMinor,
  moneyEquals,
  moneyGreater,
  parseMoneyInput,
  subMoney,
  toMinor,
} from '@/features/budget/utils/money';

describe('money minor units', () => {
  it('rounds to cents without float drift', () => {
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(fromMinor(30)).toBe(0.3);
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(subMoney(1, 0.3)).toBe(0.7);
  });

  it('compares and clamps', () => {
    expect(moneyEquals(10, 10)).toBe(true);
    expect(moneyEquals(10, 10.01)).toBe(false);
    expect(moneyGreater(10.01, 10)).toBe(true);
    expect(clampMoney(-5)).toBe(0);
    expect(clampMoney(12.345)).toBe(12.35);
  });

  it('parses user input', () => {
    expect(parseMoneyInput('1200')).toBe(1200);
    expect(parseMoneyInput('1,200.50')).toBe(1200.5);
    expect(parseMoneyInput('12.5')).toBe(12.5);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('-1')).toBeNull();
    expect(parseMoneyInput('12.345')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('0')).toBe(0);
  });

  it('formats currency and percent', () => {
    expect(formatMoney(45000, 'ETB')).toContain('45');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.333)).toBe('33.3%');
    expect(formatPercent(1)).toBe('100%');
  });
});
