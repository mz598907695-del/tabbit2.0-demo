import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWidgetConfig, sanitizeHabitWidgetConfig, sanitizeAICardStorage } from '../../src/personalized-home-2-0/board/unified-widget-config.js';
import { localDay, habitStreak } from '../../src/personalized-home-2-0/board/extra-widget-data.js';

test('retains nested editable widget state across serialization', () => {
  const input = { items: [{ id: 'task-1', title: '读完一章', done: true }], target: 8, running: false, endAt: null, zones: ['Asia/Shanghai', 'Europe/London'] };
  assert.deepEqual(sanitizeWidgetConfig(JSON.parse(JSON.stringify(input))), input);
});
test('AI card storage round-trips long accepted entries without truncation', () => {
  const entry = { key:'note',value:'字'.repeat(15000),updatedAt:'2026-11-11T00:00:00Z' };
  assert.deepEqual(sanitizeAICardStorage({note:entry}), {note:entry});
  assert.deepEqual(sanitizeAICardStorage({note:{...entry,value:'字'.repeat(23000)}}), {});
});
test('bounds imported configuration and rejects unsafe keys/non-finite numbers', () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"title":"test","items":[]}');
  input.invalid = Infinity;
  input.items = Array.from({ length: 500 }, () => ({ text: 'x'.repeat(11000) }));
  const result = sanitizeWidgetConfig(input);
  assert.equal(Object.hasOwn(result, '__proto__'), false);
  assert.equal(Object.hasOwn(result, 'invalid'), false);
  assert.ok(result.items.length <= 200);
  assert.ok(result.items[0].text.length <= 10000);
  assert.ok(JSON.stringify(result).length < 105000);
});
test('habit history survives a reload past 200 days without losing the latest check-in', () => {
  const today = new Date(2026, 10, 11, 12);
  const dates = Array.from({ length: 230 }, (_, i) => {
    const day = new Date(today); day.setDate(day.getDate() - 229 + i); return localDay(day);
  });
  const saved = sanitizeHabitWidgetConfig(JSON.parse(JSON.stringify({ name: '阅读', locale: 'en-US', dates })));
  assert.deepEqual(saved.dates, dates);
  assert.equal(saved.dates.includes(localDay(today)), true);
  assert.equal(habitStreak(saved.dates, today), 230);
  assert.equal(saved.name, '阅读');
  assert.equal(saved.locale, 'en-US');
  assert.equal(sanitizeWidgetConfig({ dates }).dates.length, 200);
});
test('habit-specific sanitization keeps only the newest 3660 unique valid dates', () => {
  const start = new Date(2000, 0, 1, 12);
  const dates = Array.from({ length: 3700 }, (_, i) => {
    const day = new Date(start); day.setDate(day.getDate() + i); return localDay(day);
  });
  const input = [...dates.reverse(), '2026-02-30', '', null, {}, '2010-02-30', dates[0]];
  const saved = sanitizeHabitWidgetConfig({ dates: input, extra: Array.from({ length: 230 }, (_, i) => i) });
  assert.equal(saved.dates.length, 3660);
  assert.deepEqual(saved.dates, [...dates].sort().slice(-3660));
  assert.equal(saved.extra.length, 200);
  assert.deepEqual(sanitizeHabitWidgetConfig({ dates: 'invalid' }).dates, []);
});
