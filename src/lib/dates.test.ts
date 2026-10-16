import { expect, test } from 'bun:test';

import { daysInMonth, indexOf, isoWeek, monthAt, parseYmd, ymd } from './dates';

test('iso week numbers', () => {
  expect(isoWeek(2026, 0, 1)).toBe(1); // Thursday
  expect(isoWeek(2027, 0, 1)).toBe(53); // Friday belongs to 2026-W53
  expect(isoWeek(2024, 11, 30)).toBe(1); // Monday belongs to 2025-W01
  expect(isoWeek(2026, 9, 18)).toBe(42); // Sunday
});

test('month helpers', () => {
  expect(daysInMonth(2024, 1)).toBe(29);
  expect(daysInMonth(2026, 1)).toBe(28);
  expect(monthAt(indexOf(new Date(2026, 9, 16)))).toEqual({ year: 2026, month: 9 });
  expect(ymd(2026, 0, 5)).toBe('2026-01-05');
});

test('parseYmd rejects bad input', () => {
  expect(parseYmd('2026-02-30')).toBeNull();
  expect(parseYmd('nope')).toBeNull();
  expect(parseYmd('2026-10-16')?.getDate()).toBe(16);
});
