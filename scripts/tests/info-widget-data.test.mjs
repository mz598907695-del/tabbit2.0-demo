import test from 'node:test';
import assert from 'node:assert/strict';
import { monthCells, clockParts, dailyInfoQuote, usageReading, normalizeNews, normalizeChinaNewsItems, normalizeWeather, weatherUrl, weatherDescription, buildNewsUrl, safeInfoLink } from '../../src/personalized-home-2-0/board/info-widget-data.js';

test('calendar includes every real day and pads to complete Monday-first weeks', () => {
  for (const [year, month, count] of [[2024, 1, 29], [2026, 1, 28], [2026, 10, 30], [2027, 1, 28]]) {
    const cells = monthCells(year, month);
    assert.equal(cells.length % 7, 0);
    assert.deepEqual(cells.filter(Boolean), Array.from({length: count}, (_, i) => i + 1));
    assert.equal(cells.indexOf(1), (new Date(year, month, 1).getDay() + 6) % 7);
  }
});
test('clock shows real zoned time including midnight and tolerates obsolete time zones', () => {
  const instant = new Date('2026-11-10T16:03:08Z');
  assert.equal(clockParts(instant, 'Asia/Shanghai').time, '00:03');
  assert.equal(clockParts(instant, 'America/New_York').time, '11:03');
  assert.equal(clockParts(instant, 'UTC').seconds, '08');
  assert.equal(clockParts(instant, 'invalid/timezone').timeZone, '');
});
test('allowance distinguishes unknown from a real zero and preserves old config', () => {
  for (const usedPercent of [null, '', ' ', false, undefined, 'not-a-number']) assert.equal(usageReading({usedPercent}).hasValue, false);
  assert.deepEqual(usageReading({usedPercent: 0}), {hasValue: true, used: 0, remaining: 100});
  assert.equal(usageReading({usedPercent: '43.5'}).remaining, 56.5);
  assert.equal(usageReading({usedPercent: 500}).remaining, 0);
});
test('news preserves original titles and distinguishes index time from publication time', () => {
  const gdelt = normalizeNews({articles:[{title:'真实中文标题',url:'https://example.com/report',domain:'example.com',seendate:'20261111T040000Z'},{title:'真实中文标题',url:'https://example.com/duplicate'},{title:'invalid',url:'javascript:alert(1)'}]});
  assert.equal(gdelt.length, 1);
  assert.equal(gdelt[0].observedAt, '2026-11-11T04:00:00Z');
  assert.equal(gdelt[0].publishedAt, undefined);
  const official = normalizeChinaNewsItems([{title:'新闻',url:'https://www.chinanews.com.cn/report',publishedAt:'Wed, 11 Nov 2026 12:44:28 +0800'}]);
  assert.equal(official[0].publishedAt, '2026-11-11T04:44:28.000Z');
  assert.equal(official[0].source, '中新网');
  assert.equal(official[0].observedAt, undefined);
  const english = normalizeChinaNewsItems([{title:'A report',url:'https://www.ecns.cn/report',publishedAt:'2026-11-11 10:42:42'}], 'ECNS');
  assert.equal(english[0].publishedAt, '');
  assert.equal(english[0].publishedLabel, '2026-11-11 10:42:42');
  assert.equal(english[0].source, 'ECNS');
  assert.throws(() => normalizeNews({error:'bad response'}));
});
test('news requests choose actual language and reject unsafe outbound protocols', () => {
  assert.match(new URL(buildNewsUrl()).searchParams.get('query'), /sourcelang:chinese/);
  assert.match(new URL(buildNewsUrl('en','technology')).searchParams.get('query'), /sourcelang:english/);
  assert.equal(safeInfoLink('data:text/html,hello'), '');
  assert.equal(safeInfoLink('javascript:alert(1)'), '');
});
test('weather rejects absent readings, starts forecast after current time, and keeps temperatures numerical', () => {
  assert.throws(() => normalizeWeather({current:{temperature_2m:null,weather_code:0}}));
  const value = normalizeWeather({current:{temperature_2m:9.8,weather_code:0,time:'2026-11-11T12:45'},hourly:{time:['2026-11-11T12:00','2026-11-11T13:00','2026-11-11T14:00'],temperature_2m:[9,10,11]},timezone:'Asia/Shanghai'});
  assert.deepEqual(value.hourly.map(h => h.value), [10,11]);
  assert.equal(value.current.temperature_2m, 9.8);
  assert.deepEqual(normalizeWeather({current:{temperature_2m:9,weather_code:0,time:'2026-11-12T12:00'},hourly:{time:['2026-11-11T12:00'],temperature_2m:[9]}}).hourly, []);
  assert.equal(weatherDescription(86,'zh-CN'), '雪');
  assert.equal(weatherDescription(95,'en-US'), 'Thunderstorms');
  assert.equal(new URL(weatherUrl(100,-200)).searchParams.get('latitude'), '90');
  assert.equal(new URL(weatherUrl(100,-200)).searchParams.get('longitude'), '-180');
});
test('daily thoughts respect custom content and have separate English defaults', () => {
  const date = new Date(2026,10,11,12);
  assert.equal(dailyInfoQuote({text:'自己的句子',author:'署名'},'en-US',date).text,'自己的句子');
  assert.match(dailyInfoQuote({},'zh-CN',date).text, /[\u4e00-\u9fff]/);
  assert.doesNotMatch(dailyInfoQuote({},'en-US',date).text, /[\u4e00-\u9fff]/);
  assert.notEqual(dailyInfoQuote({},'zh-CN',date).text, dailyInfoQuote({index:1},'zh-CN',date).text);
});
