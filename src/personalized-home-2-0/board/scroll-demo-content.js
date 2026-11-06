import { shortcutCatalog } from './shortcut-catalog.js';

// Version 1 could be stamped by a live-reloaded preview before its state initializer ran.
export const COMMON_SCROLL_DEMO_VERSION = 2;
export const COMMON_SCROLL_DEMO_COUNT = 84;

// Deliberate local examples for exercising a long homepage, never browsing data.
const preferredSites = [
  'domestic-004', 'international-065', 'domestic-023', 'international-087',
  'domestic-049', 'international-112', 'domestic-043', 'international-079',
  'domestic-007', 'domestic-008', 'domestic-013', 'international-061',
  'international-064', 'international-066', 'domestic-005', 'domestic-024',
  'international-082', 'international-086', 'domestic-029', 'domestic-054',
  'international-111', 'international-110', 'domestic-050', 'international-114',
  'international-104', 'international-105', 'international-106', 'international-108',
  'domestic-010', 'domestic-019', 'domestic-031', 'domestic-032',
  'domestic-035', 'domestic-055', 'domestic-058', 'domestic-059',
  'international-070', 'international-073', 'international-081', 'international-109',
  'domestic-003', 'domestic-006', 'domestic-021', 'domestic-030',
];

function upcomingDate(days, today) {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function demoWidgets(today) {
  return [
    ['calendar', '日历', { monthOffset: 0 }, 2, 2],
    ['weather', '北京天气', { city: '北京市', temperature: '23', condition: '多云' }, 2, 1],
    ['reminder', '今日待办', { text: '整理本周灵感\n留一点时间读书' }, 2, 2],
    ['quote', '每日一句', { index: 0, text: '', author: '' }, 4, 2],
    ['image', '窗外风景', { caption: '给眼睛放个假' }, 2, 2],
    ['countdown', '周末计划', { event: '下一次出发', targetDate: upcomingDate(14, today) }, 2, 2],
    ['news', '灵感速递', { index: 0 }, 4, 2],
    ['draw', '今日灵感签', { index: 0 }, 2, 2],
    ['joke', '轻松一刻', { text: '今天的代码没有报错，只是在认真思考。' }, 2, 2],
    ['weather', '杭州天气', { city: '杭州市', temperature: '25', condition: '晴' }, 2, 1],
    ['reminder', '生活清单', { text: '给绿植浇水\n傍晚出去走一走' }, 4, 2],
    ['calendar', '下月日历', { monthOffset: 1 }, 2, 2],
    ['countdown', '阅读计划', { event: '读完一本好书', targetDate: upcomingDate(30, today) }, 2, 2],
    ['quote', '慢下来', { index: 1, text: '', author: '' }, 2, 2],
    ['image', '午后山丘', { caption: '把风景放进日常' }, 4, 2],
    ['news', '生活发现', { index: 1 }, 4, 2],
    ['draw', '小小好兆头', { index: 3 }, 2, 2],
    ['joke', '会心一笑', { text: '代码是程序员思维的镜子' }, 2, 2],
  ].map(([kind, title, config, w, h], index) => ({
    id: `common-scroll-v1-widget-${index}`, type: 'widget', kind, title, config, size: { w, h },
  }));
}

const originOf = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; } };

export function makeCommonScrollDemoItems(existingItems, occupiedIds, count, today = new Date()) {
  const origins = new Set(existingItems.filter(item => item.type === 'shortcut').map(item => originOf(item.url)));
  const byId = new Map(shortcutCatalog.map(site => [site.id, site]));
  const candidates = [...preferredSites.map(id => byId.get(id)), ...shortcutCatalog];
  const shortcuts = [];
  for (const site of candidates) {
    const origin = originOf(site.url);
    const id = `common-scroll-v1-site-${site.id}`;
    if (!origin || origins.has(origin) || occupiedIds.has(id)) continue;
    origins.add(origin);
    shortcuts.push({ id, type: 'shortcut', key: 'custom', label: site.label, service: site.label, url: site.url, image: site.image });
  }
  const existingWidgetCount = existingItems.filter(item => item.type === 'widget').length;
  const widgets = demoWidgets(today).filter(item => !occupiedIds.has(item.id)).slice(0, Math.max(0, 18 - existingWidgetCount));
  const result = [];
  // Start with a widget, then alternate small clusters of links and cards.
  // Existing content remains first; no replacement or sorting of user items.
  while (result.length < count && (widgets.length || shortcuts.length)) {
    if (widgets.length) result.push(widgets.shift());
    for (let n = 0; n < 2 && shortcuts.length && result.length < count; n++) result.push(shortcuts.shift());
  }
  return result.slice(0, count);
}
