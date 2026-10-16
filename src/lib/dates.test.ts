import { expect, test } from 'bun:test';

import { daysInMonth, eventStart, indexOf, isoWeek, monthAt, parseYmd, whenText, ymd } from './dates';

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

test('reminder text', () => {
  const start = eventStart({ date: '2026-10-20', time: '10:30' })!;
  expect(start.getHours()).toBe(10);
  expect(eventStart({ date: '2026-10-20', time: null })).toBeNull();
  expect(whenText(start, new Date(2026, 9, 20, 9, 30))).toBe('Oggi alle 10:30');
  expect(whenText(start, new Date(2026, 9, 19, 10, 30))).toBe('Domani alle 10:30');
  expect(whenText(start, new Date(2026, 9, 13, 10, 30))).toBe('Martedì 20 ottobre 2026 alle 10:30');
});
