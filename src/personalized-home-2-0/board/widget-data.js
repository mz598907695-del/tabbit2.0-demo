// Calendar-day arithmetic uses UTC ordinals so DST never adds or removes a day.
export function calendarCells(year, month) {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= days ? day : null;
  });
}

export function daysUntil(value, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  if (target.getUTCFullYear() !== year || target.getUTCMonth() !== month - 1 || target.getUTCDate() !== day) return null;
  return Math.round((target.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

export const DRAW_RESULTS = [
  { title: '上上签', note: '好事正在路上', color: 'coral' },
  { title: '宜出发', note: '小小一步，也是进步', color: 'blue' },
  { title: '慢慢来', note: '允许自己歇一会儿', color: 'green' },
  { title: '好灵感', note: '换个角度，答案就来了', color: 'purple' },
];

export const DAILY_QUOTES = [
  { text: '把平凡的日子，过成喜欢的样子。', author: '今日寄语' },
  { text: '走慢一点，也会遇见沿途的风景。', author: '今日寄语' },
  { text: '不必等一切准备好，今天就可以开始。', author: '今日寄语' },
  { text: '给好奇心一点时间，给生活一点留白。', author: '今日寄语' },
];

// Explicit local demo headlines, never presented as current reporting.
export const DEMO_NEWS = [
  [
    { category: '科技', title: '把重复的工作交给工具，把时间留给创造' },
    { category: '生活', title: '周末灵感：给自己安排一场城市漫步' },
    { category: '设计', title: '从一枚按钮开始，发现日常设计的细节' },
  ],
  [
    { category: '阅读', title: '今天读什么？从书架上重逢一本旧书' },
    { category: '灵感', title: '让桌面焕然一新，从整理一个小角落开始' },
    { category: '生活', title: '抬头看一看，记下今天的天空' },
  ],
];

export function safeIndex(value, length) {
  const number = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  return ((number % length) + length) % length;
}
