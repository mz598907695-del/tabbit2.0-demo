// Data is local to each board item. A widget owns its task; the board owns its frame.
export const extraWidgetCatalog = [
  { kind: 'world-clock', title: '世界时钟', description: '跨越时区，同步查看各地此刻的时间。', defaultConfig: { zones: ['Asia/Shanghai', 'Europe/London', 'America/New_York'] }, defaultSize: { w: 4, h: 3 } },
  { kind: 'habits', title: '习惯打卡', description: '每天一小步，记录属于你的坚持。', defaultConfig: { name: '阅读 20 分钟', dates: [] }, defaultSize: { w: 3, h: 3 } },
  { kind: 'hydration', title: '喝水提醒', description: '记录今天喝了几杯水，设定自己的节奏。', defaultConfig: { goal: 8, count: 0, date: '', intervalMinutes: 60, lastDrink: 0 }, defaultSize: { w: 3, h: 3 } },
  { kind: 'reading', title: '阅读进度', description: '把正在读的书，读到的那一页留在首页。', defaultConfig: { book: '', page: 0, total: 300 }, defaultSize: { w: 3, h: 3 } },
  { kind: 'anniversary', title: '纪念日', description: '记住一个重要日期，看看它离今天有多远。', defaultConfig: { name: '值得纪念的一天', date: '' }, defaultSize: { w: 3, h: 3 } },
  { kind: 'breathing', title: '呼吸练习', description: '用一分钟慢下来，跟随节奏吸气与呼气。', defaultConfig: { sessions: 0, lastSession: '', startedAt: 0 }, defaultSize: { w: 3, h: 3 } },
  { kind: 'quick-links', title: '快捷链接', description: '把常去的网站放在一起，一点即达。', defaultConfig: { links: [] }, defaultSize: { w: 4, h: 3 } },
  { kind: 'weekly-goals', title: '本周目标', description: '选几件重要的事，让这一周更有方向。', defaultConfig: { week: '', goals: [] }, defaultSize: { w: 3, h: 3 } },
  { kind: 'expenses', title: '记账本', description: '随手记下一笔，清楚看到本月支出。', defaultConfig: { entries: [] }, defaultSize: { w: 4, h: 3 } },
  { kind: 'time-progress', title: '时间进度', description: '今天、本周、今年，时间走到了哪里。', defaultConfig: { period: 'year' }, defaultSize: { w: 3, h: 3 } },
];

export const WORLD_ZONES = [
  ['Asia/Shanghai', '北京'], ['Asia/Tokyo', '东京'], ['Asia/Singapore', '新加坡'],
  ['Asia/Dubai', '迪拜'], ['Europe/London', '伦敦'], ['Europe/Paris', '巴黎'],
  ['America/New_York', '纽约'], ['America/Los_Angeles', '洛杉矶'], ['Australia/Sydney', '悉尼'],
];
export function boundedNumber(value, fallback = 0, min = 0, max = 1000000) {
  const number = Number(value);
  return value !== '' && Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(0); date.setFullYear(y, m - 1, d); date.setHours(0, 0, 0, 0);
  return localDay(date) === value ? date : null;
}
export function calendarDifference(value, now = new Date()) {
  const date = parseDay(value);
  if (!date) return null;
  const stamp = d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((stamp(now) - stamp(date)) / 86400000);
}
export function weekStart(now = new Date()) {
  const date = new Date(now); date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDay(date);
}
export function recentDays(now = new Date(), count = 7) {
  return Array.from({ length: count }, (_, index) => { const d = new Date(now); d.setDate(d.getDate() - count + index + 1); return localDay(d); });
}
export function habitStreak(dates, now = new Date()) {
  const set = new Set(Array.isArray(dates) ? dates : []);
  const d = new Date(now);
  if (!set.has(localDay(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(localDay(d)) && streak < 3660) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
export function safeLink(value) {
  try { const url = new URL(String(value).includes('://') ? value : `https://${value}`); return ['https:', 'http:'].includes(url.protocol) && url.hostname ? url.href : ''; } catch { return ''; }
}
export function amountToCents(value) {
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(String(value).trim())) return null;
  const [whole, fraction = ''] = String(value).trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}
export function timeProgress(period, now = new Date()) {
  let start; let end;
  if (period === 'day') { start = new Date(now); start.setHours(0, 0, 0, 0); end = new Date(start); end.setDate(end.getDate() + 1); }
  else if (period === 'week') { start = parseDay(weekStart(now)); end = new Date(start); end.setDate(end.getDate() + 7); }
  else { start = new Date(now.getFullYear(), 0, 1); end = new Date(now.getFullYear() + 1, 0, 1); }
  return { percent: Math.min(100, Math.max(0, (now - start) / (end - start) * 100)), remainingHours: Math.max(0, Math.ceil((end - now) / 3600000)) };
}

export const WORLD_ZONE_EN = ['Beijing', 'Tokyo', 'Singapore', 'Dubai', 'London', 'Paris', 'New York', 'Los Angeles', 'Sydney'];
export function zoneTime(zone, now = new Date(), locale = 'zh-CN') {
  const formatter = new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find(part => part.type === 'minute')?.value || 0);
  return { time: formatter.format(now), hour, minute, daytime: hour >= 6 && hour < 18 };
}
export function nextAnniversary(value, now = new Date()) {
  const source = parseDay(value);
  if (!source) return null;
  const build = year => {
    // A leap-day anniversary falls on February's last day in a non-leap year.
    const last = new Date(year, source.getMonth() + 1, 0).getDate();
    return new Date(year, source.getMonth(), Math.min(source.getDate(), last));
  };
  let next = build(now.getFullYear());
  if (calendarDifference(localDay(next), now) > 0) next = build(now.getFullYear() + 1);
  return { date: localDay(next), days: Math.max(0, -calendarDifference(localDay(next), now)) };
}
export function breathingState(startedAt, now = Date.now()) {
  const start = Number(startedAt);
  if (!Number.isFinite(start) || start <= 0) return { running: false, complete: false, elapsed: 0, remaining: 60, inhale: true, expansion: 0 };
  const elapsed = Math.max(0, (Number(now) - start) / 1000);
  const phase = elapsed % 10;
  return { running: elapsed < 60, complete: elapsed >= 60, elapsed: Math.min(60, elapsed), remaining: Math.max(0, Math.ceil(60 - elapsed)), inhale: phase < 4, expansion: phase < 4 ? phase / 4 : 1 - (phase - 4) / 6 };
}
export function expenseMonth(entries, month) {
  const safe = (Array.isArray(entries) ? entries : []).filter(entry => entry && parseDay(entry.date) && Number.isSafeInteger(entry.cents) && entry.cents > 0);
  const current = safe.filter(entry => entry.date.slice(0, 7) === month);
  const total = current.reduce((sum, entry) => sum + entry.cents, 0);
  const [year, monthNumber] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(year, monthNumber, 0).getDate() }, (_, i) => {
    const date = month + '-' + String(i + 1).padStart(2, '0');
    return current.filter(entry => entry.date === date).reduce((sum, entry) => sum + entry.cents, 0);
  });
  return { entries: current, total, days };
}
export function expensesCSV(entries, locale = 'zh-CN') {
  const cell = value => {
    let text = String(value ?? '');
    // Prevent spreadsheet formula execution when exporting user-written labels.
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [[...(locale.startsWith('en') ? ['Date', 'Description', 'Amount (CNY)'] : ['日期', '用途', '金额（元）'])],
    ...entries.map(entry => [entry.date, entry.label || '', (entry.cents / 100).toFixed(2)])];
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
