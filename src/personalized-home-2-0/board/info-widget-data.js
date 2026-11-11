// Public data only. Account credentials and AI balances are never requested.
// Sources: https://open-meteo.com/en/docs /en/docs/geocoding-api
// https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
export const CHINA_NEWS_RSS = 'https://www.chinanews.com.cn/rss/scroll-news.xml';
export const ECNS_RSS = 'https://www.ecns.cn/rss/rss.xml';
export const INFO_CACHE_TTL = { weather: 10 * 60_000, news: 10 * 60_000 };
const memoryCache = new Map();
const pendingRequests = new Map();
const CACHE_PREFIX = 'tabbit-info-v2:';
export const infoText = (locale, zh, en) => locale === 'en-US' ? en : zh;
export const infoString = (value, fallback = '') => typeof value === 'string' ? value : fallback;
export const clampNumber = (value, min, max, fallback = min) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
export const infoLocale = value => value === 'en-US' ? 'en-US' : 'zh-CN';
export const safeInfoLink = value => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; } catch { return ''; } };

export function readInfoCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const item = JSON.parse(globalThis.localStorage?.getItem(CACHE_PREFIX + key) || 'null');
    if (item?.data && Number.isFinite(item.at) && Date.now() - item.at < 7 * 86_400_000) { memoryCache.set(key, item); return item; }
  } catch { /* A full or unavailable browser store does not block a widget. */ }
  return null;
}
export function writeInfoCache(key, data) {
  const item = { data, at: Date.now() };
  memoryCache.set(key, item);
  try { globalThis.localStorage?.setItem(CACHE_PREFIX + key, JSON.stringify(item)); } catch { /* Memory cache remains usable. */ }
  return item;
}
export function fetchInfoResource(key, load) {
  if (pendingRequests.has(key)) return pendingRequests.get(key);
  const request = load().then(data => writeInfoCache(key, data)).finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, request);
  return request;
}
export async function fetchInfoJson(url, { signal, timeout = 22_000, responseType = 'json' } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
    if (!response.ok) throw new Error(response.status === 429 ? 'rate-limit' : 'network');
    return responseType === 'text' ? await response.text() : await response.json();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function buildNewsUrl(language = 'zh', category = 'general') {
  const topics = { technology: '(technology OR science OR "artificial intelligence")', world: '(world OR international)', general: '' };
  const query = [topics[category] || '', `sourcelang:${language === 'en' ? 'english' : 'chinese'}`].filter(Boolean).join(' ');
  return `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({ query, mode: 'artlist', format: 'json', maxrecords: '20', sort: 'datedesc', timespan: '1d' })}`;
}
export function normalizeNews(payload) {
  if (!Array.isArray(payload?.articles)) throw new Error('invalid-news');
  const seen = new Set();
  return payload.articles.flatMap(article => {
    const url = safeInfoLink(article?.url), title = infoString(article?.title).trim();
    if (!url || !title || seen.has(title)) return [];
    seen.add(title);
    const raw = infoString(article.seendate);
    const date = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
    const observedAt = date ? `${date[1]}-${date[2]}-${date[3]}T${date[4]}:${date[5]}:${date[6]}Z` : '';
    return [{ url, title, source: infoString(article.domain) || new URL(url).hostname, observedAt }];
  }).slice(0, 20);
}
export function normalizeChinaNewsItems(items, source = '中新网') {
  const seen = new Set();
  return items.flatMap(item => {
    const url = safeInfoLink(item.url), title = infoString(item.title).trim();
    if (!url || !title || seen.has(url)) return [];
    seen.add(url);
    const rawDate = infoString(item.publishedAt).trim();
    // ECNS publishes a wall-clock string without a time zone. Preserve it as
    // publisher time instead of silently converting it using the reader's zone.
    const publishedLabel = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawDate) ? rawDate : '';
    const date = new Date(rawDate);
    return [{ url, title, source, publishedAt: !publishedLabel && Number.isFinite(date.getTime()) ? date.toISOString() : '', ...(publishedLabel ? { publishedLabel } : {}) }];
  }).slice(0, 20);
}
export async function loadInfoNews(language, category, source = 'chinanews') {
  if (source === 'gdelt') return normalizeNews(await fetchInfoJson(buildNewsUrl(language, category)));
  const english = language === 'en' || source === 'ecns';
  const xml = await fetchInfoJson(english ? ECNS_RSS : CHINA_NEWS_RSS, { responseType: 'text' });
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('rss > channel')) throw new Error('invalid-news');
  return normalizeChinaNewsItems([...doc.querySelectorAll('channel > item')].map(item => ({ title: item.querySelector('title')?.textContent, url: item.querySelector('link')?.textContent, publishedAt: item.querySelector('pubDate')?.textContent })), english ? 'ECNS' : '中新网');
}
export function weatherUrl(latitude, longitude) {
  return `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({ latitude: String(clampNumber(latitude, -90, 90, 39.9042)), longitude: String(clampNumber(longitude, -180, 180, 116.4074)), current: 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,is_day', hourly: 'temperature_2m', daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset', forecast_days: '2', timezone: 'auto' })}`;
}
export function normalizeWeather(payload) {
  const raw = payload?.current;
  if (!raw || !Number.isFinite(raw.temperature_2m) || !Number.isFinite(raw.weather_code)) throw new Error('invalid-weather');
  const hourly = Array.isArray(payload.hourly?.time) ? payload.hourly.time.flatMap((time, i) => Number.isFinite(payload.hourly.temperature_2m?.[i]) ? [{ time, value: payload.hourly.temperature_2m[i] }] : []) : [];
  const firstFuture = hourly.findIndex(item => item.time >= raw.time);
  const nowIndex = firstFuture < 0 ? hourly.length : firstFuture;
  return { current: raw, hourly: hourly.slice(nowIndex, nowIndex + 12), daily: payload.daily || {}, timezone: infoString(payload.timezone), utcOffset: Number(payload.utc_offset_seconds) || 0 };
}
export const loadInfoWeather = async (latitude, longitude) => normalizeWeather(await fetchInfoJson(weatherUrl(latitude, longitude)));
export async function searchInfoCities(query, locale, signal) {
  const result = await fetchInfoJson(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: query.trim(), count: '6', language: locale === 'en-US' ? 'en' : 'zh', format: 'json' })}`, { signal, timeout: 12_000 });
  return Array.isArray(result.results) ? result.results.filter(city => Number.isFinite(city.latitude) && Number.isFinite(city.longitude)) : [];
}
export function weatherDescription(code, locale) {
  let value;
  if (code === 0) value = ['晴', 'Clear'];
  else if (code <= 3) value = ['多云', 'Cloudy'];
  else if ([45, 48].includes(code)) value = ['雾', 'Fog'];
  else if (code >= 95) value = ['雷雨', 'Thunderstorms'];
  else if ([71, 73, 75, 77, 85, 86].includes(code)) value = ['雪', 'Snow'];
  else if ([51, 53, 55, 56, 57].includes(code)) value = ['小雨', 'Drizzle'];
  else value = ['雨', 'Rain'];
  return infoText(locale, ...value);
}
export function monthCells(year, month) {
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const size = Math.ceil((start + count) / 7) * 7;
  return Array.from({ length: size }, (_, i) => i >= start && i < start + count ? i - start + 1 : null);
}
export function clockParts(now, timeZone, locale = 'zh-CN') {
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
  try { if (timeZone) new Intl.DateTimeFormat(locale, { timeZone }).format(now); } catch { timeZone = ''; }
  if (timeZone) options.timeZone = timeZone;
  const parts = Object.fromEntries(new Intl.DateTimeFormat(locale, options).formatToParts(now).map(p => [p.type, p.value]));
  return { time: `${parts.hour}:${parts.minute}`, seconds: parts.second, timeZone, date: now.toLocaleDateString(locale, { ...(timeZone ? { timeZone } : {}), month: 'short', day: 'numeric', weekday: 'short' }) };
}
const QUOTES = [
  ['把平凡的日子，过成喜欢的样子。', 'Make an ordinary day a day you love.'],
  ['走慢一点，也会遇见沿途的风景。', 'Slow down. There is beauty along the way.'],
  ['不必等一切准备好，今天就可以开始。', 'You can start before everything is ready.'],
  ['给好奇心一点时间，给生活一点留白。', 'Make room for curiosity. Leave a little space.'],
  ['专注眼前的一步，答案会慢慢清晰。', 'Focus on the next step. Clarity will follow.'],
  ['认真生活，也记得轻松一点。', 'Care about your days. Go gently, too.'],
  ['今天的小小进步，也值得被记住。', 'A small step today is still worth remembering.'],
  ['停一停，听见自己的节奏。', 'Pause. Find your own rhythm.'],
];
export function dailyInfoQuote(config, locale, now = new Date()) {
  const ordinal = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const index = ((ordinal + Math.trunc(Number(config.index) || 0)) % QUOTES.length + QUOTES.length) % QUOTES.length;
  return { text: infoString(config.text).trim() || QUOTES[index][locale === 'en-US' ? 1 : 0], author: infoString(config.author).trim() || infoText(locale, '今日寄语', 'A daily thought'), index };
}
export function usageReading(config) {
  const raw = config.usedPercent;
  const hasValue = (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) && Number.isFinite(Number(raw));
  const used = clampNumber(raw, 0, 100);
  return { hasValue, used, remaining: 100 - used };
}
