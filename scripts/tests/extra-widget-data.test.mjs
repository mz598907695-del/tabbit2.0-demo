import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDifference, weekStart, habitStreak, safeLink, amountToCents, timeProgress, extraWidgetCatalog, zoneTime, nextAnniversary, breathingState, expenseMonth, expensesCSV } from '../../src/personalized-home-2-0/board/extra-widget-data.js';

test('calendar widgets reject rolled-over dates and count calendar days', () => {
  assert.equal(calendarDifference('2026-02-30', new Date(2026, 2, 1)), null);
  assert.equal(calendarDifference('2026-11-10', new Date(2026, 10, 11, 1)), 1);
  assert.equal(calendarDifference('2026-11-12', new Date(2026, 10, 11, 23)), -1);
  assert.equal(weekStart(new Date(2026, 10, 15)), '2026-11-09');
});
test('habit streak allows today to be pending but never bridges a missing day', () => {
  const now = new Date(2026, 10, 11);
  assert.equal(habitStreak(['2026-11-09', '2026-11-10'], now), 2);
  assert.equal(habitStreak(['2026-11-09', '2026-11-11'], now), 1);
  assert.equal(habitStreak(['2026-11-09'], now), 0);
});
test('expense amounts preserve decimal cents and reject ambiguous input', () => {
  assert.equal(amountToCents('0.29'), 29);
  assert.equal(amountToCents('1234.5'), 123450);
  for (const value of ['0', '-1', '1.234', '1e3', 'Infinity', 'abc']) assert.equal(amountToCents(value), null);
});
test('quick links support web URLs and disallow executable or local schemes', () => {
  assert.equal(safeLink('example.com/path'), 'https://example.com/path');
  assert.equal(safeLink('https://example.com'), 'https://example.com/');
  for (const value of ['javascript:alert(1)', 'file:///tmp/a', 'data:text/html,test', '']) assert.equal(safeLink(value), '');
});
test('time progress is computed from the actual selected period', () => {
  const value = timeProgress('day', new Date(2026, 10, 11, 12));
  assert.equal(value.percent, 50);
  assert.equal(value.remainingHours, 12);
  assert.equal(timeProgress('year', new Date(2026, 0, 1)).percent, 0);
  assert.equal(new Set(extraWidgetCatalog.map(item => item.kind)).size, 10);
});
test('world clock computes local time and day/night from each timezone', () => {
  const now = new Date('2026-11-11T00:30:00Z');
  assert.deepEqual(zoneTime('Asia/Shanghai', now), { time: '08:30', hour: 8, minute: 30, daytime: true });
  assert.equal(zoneTime('America/New_York', now, 'en-US').daytime, false);
  assert.equal(zoneTime('America/New_York', now, 'en-US').time, '19:30');
});
test('anniversary moves to next year and handles leap-day dates', () => {
  assert.deepEqual(nextAnniversary('2020-11-10', new Date(2026, 10, 11)), { date: '2027-11-10', days: 364 });
  assert.deepEqual(nextAnniversary('2020-11-11', new Date(2026, 10, 11)), { date: '2026-11-11', days: 0 });
  assert.deepEqual(nextAnniversary('2024-02-29', new Date(2027, 1, 27)), { date: '2027-02-28', days: 1 });
  assert.equal(nextAnniversary('invalid'), null);
});
test('breathing resumes from a persisted timestamp and finishes only after a minute', () => {
  const start = 1000000;
  assert.equal(breathingState(0, start).running, false);
  assert.equal(breathingState(start, start + 3000).inhale, true);
  assert.equal(breathingState(start, start + 7000).inhale, false);
  assert.equal(breathingState(start, start + 7000).remaining, 53);
  assert.equal(breathingState(start, start + 59999).complete, false);
  assert.equal(breathingState(start, start + 60000).complete, true);
  assert.equal(breathingState(start, start + 180000).remaining, 0);
});
test('expense aggregation excludes other months and keeps exact cents', () => {
  const entries = [{ date: '2026-11-01', cents: 29 }, { date: '2026-11-01', cents: 71 }, { date: '2026-11-11', cents: 2000 }, { date: '2026-10-31', cents: 9000 }, { date: '2026-11-11', cents: -1 }];
  const summary = expenseMonth(entries, '2026-11');
  assert.equal(summary.total, 2100);
  assert.equal(summary.entries.length, 3);
  assert.equal(summary.days.length, 30);
  assert.equal(summary.days[0], 100);
  assert.equal(summary.days[10], 2000);
});
test('CSV escapes quotes, delimiters and formula-like descriptions', () => {
  const csv = expensesCSV([{ date: '2026-11-11', label: '=HYPERLINK("https://example.com")', cents: 29 }, { date: '2026-11-11', label: 'Tea, lunch', cents: 100 }]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(csv.includes('"Tea, lunch","1.00"'));
  assert.ok(csv.includes('"0.29"'));
});
