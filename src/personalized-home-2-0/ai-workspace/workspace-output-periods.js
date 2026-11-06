function timestampDate(item) {
  if (typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) return null;
  const date = new Date(item.createdAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayRank(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

function calendarPeriod(date, now) {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, now)) return { key: 'today', label: '今天', rank: dayRank(now) };
  if (sameDay(date, yesterday)) return { key: 'yesterday', label: '昨天', rank: dayRank(yesterday) };
  return monthPeriod(date.getFullYear(), date.getMonth() + 1, now);
}

function monthPeriod(year, month, now) {
  return year === now.getFullYear()
    ? { key: `month-${year}-${month}`, label: `${month} 月`, rank: year * 10000 + month * 100 }
    : { key: `year-${year}`, label: `${year} 年`, rank: year * 10000 };
}

function outputPeriod(item, now) {
  const timestamp = timestampDate(item);
  if (timestamp) return calendarPeriod(timestamp, now);
  const label = typeof item.date === 'string' ? item.date.trim() : '';
  if (/^(今天|刚刚)(?:\s|$)/.test(label)) return calendarPeriod(now, now);
  if (/^昨天(?:\s|$)/.test(label)) return calendarPeriod(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), now);
  const full = label.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s|$)/)
    || label.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s|$)/);
  if (full) {
    const [, year, month, day] = full.map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) return calendarPeriod(date, now);
  }
  // Older demo records only have a month/day label. Group by that visible month;
  // never backfill a timestamp or change their saved order within the period.
  const partial = label.match(/^(\d{1,2})\s*月\s*(\d{1,2})\s*日(?:\s|$)/);
  if (partial) {
    const month = Number(partial[1]), day = Number(partial[2]);
    const date = new Date(2000, month - 1, day);
    if (date.getMonth() === month - 1 && date.getDate() === day) return monthPeriod(now.getFullYear(), month, now);
  }
  return { key: 'undated', label: '时间未注明', rank: null };
}

export function groupWorkspaceOutputs(items, { sort = 'recent', now = new Date() } = {}) {
  if (!items.length) return [];
  if (sort === 'name') return [{ key: 'all', label: '', items }];
  const periods = new Map();
  for (const item of items) {
    const period = outputPeriod(item, now);
    if (!periods.has(period.key)) periods.set(period.key, { ...period, items: [] });
    periods.get(period.key).items.push(item);
  }
  return [...periods.values()].sort((a, b) => {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return sort === 'oldest' ? a.rank - b.rank : b.rank - a.rank;
  });
}

export function formatWorkspaceOutputDate(item, now = new Date()) {
  const date = timestampDate(item);
  if (!date) return item.date || '';
  const period = calendarPeriod(date, now);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (period.key === 'today' || period.key === 'yesterday') return `${period.label} ${time}`;
  return `${date.getFullYear() === now.getFullYear() ? '' : `${date.getFullYear()} 年 `}${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}
