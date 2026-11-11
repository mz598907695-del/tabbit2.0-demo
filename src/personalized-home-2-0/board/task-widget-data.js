import { calculateExpression, bounded, finite, localDay, safeText } from './core-widget-data.js';

export const TASK_WIDGET_KINDS = ['countdown', 'calculator', 'pomodoro', 'draw', 'note', 'converter', 'todo', 'timetable'];
export const isEnglish = locale => String(locale || '').toLowerCase().startsWith('en');
export const taskText = (locale, zh, en) => isEnglish(locale) ? en : zh;
export function parseLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
  return localDay(date) === value ? date : null;
}
const dayStamp = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
export function countdownState(config, now = new Date()) {
  const target = parseLocalDate(config.targetDate);
  const start = parseLocalDate(config.startDate);
  if (!target) return { days: null, progress: null, total: null, target: null, start };
  const days = Math.round((dayStamp(target) - dayStamp(now)) / 86400000);
  const total = start ? Math.round((dayStamp(target) - dayStamp(start)) / 86400000) : null;
  const progress = total > 0 ? bounded((total - days) / total, 0, 1) : null;
  return { days, progress, total, target, start };
}
export function timerState(config, now = Date.now()) {
  const phase = config.phase === 'break' || config.phase === 'rest' ? 'break' : 'focus';
  const focusMinutes = bounded(config.focusMinutes ?? config.minutes, 1, 180, 25);
  const breakMinutes = bounded(config.breakMinutes, 1, 60, 5);
  const duration = Math.round((phase === 'break' ? breakMinutes : focusMinutes) * 60);
  const endAt = Math.max(0, finite(config.endAt));
  const remaining = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : Math.round(bounded(config.remaining, 0, 10800, duration));
  return { phase, focusMinutes, breakMinutes, duration, endAt, remaining, running: endAt > now, finished: endAt > 0 && endAt <= now, progress: bounded(1 - remaining / duration, 0, 1) };
}
export function startTimer(config, now = Date.now()) {
  const timer = timerState(config, now);
  const remaining = timer.remaining || timer.duration;
  return { phase: timer.phase, focusMinutes: timer.focusMinutes, breakMinutes: timer.breakMinutes, remaining, endAt: now + remaining * 1000, completionPhase: '', completionAt: 0 };
}
export function pauseTimer(config, now = Date.now()) {
  const timer = timerState(config, now);
  return { remaining: timer.remaining, endAt: 0 };
}
export function completeTimer(config, now = Date.now()) {
  const timer = timerState(config, now);
  if (!timer.finished) return null;
  const phase = timer.phase === 'focus' ? 'break' : 'focus';
  return { phase, endAt: 0, remaining: Math.round((phase === 'break' ? timer.breakMinutes : timer.focusMinutes) * 60),
    completedSessions: Math.max(0, Math.floor(finite(config.completedSessions))) + (timer.phase === 'focus' ? 1 : 0),
    completionPhase: timer.phase, completionAt: timer.endAt };
}
export function timerDisplay(seconds) {
  const value = Math.max(0, Math.floor(finite(seconds)));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function drawOptions(value) {
  return (Array.isArray(value) ? value : []).filter(item => typeof item === 'string').map(item => item.trim().slice(0, 100)).filter(Boolean).slice(0, 50);
}
export function randomChoice(options, random = values => crypto.getRandomValues(values)) {
  const choices = drawOptions(options);
  if (!choices.length) return null;
  const maximum = 0x100000000, ceiling = maximum - maximum % choices.length;
  const value = new Uint32Array(1);
  do { random(value); } while (value[0] >= ceiling);
  return { value: choices[value[0] % choices.length], index: value[0] % choices.length };
}
export function calculateWithHistory(expression, history = [], now = Date.now()) {
  const result = calculateExpression(expression);
  const previous = Array.isArray(history) ? history.filter(item => item && typeof item.expression === 'string' && typeof item.result === 'string').slice(0, 29) : [];
  return { expression: String(expression).slice(0, 180), result, history: [{ expression: String(expression).slice(0, 180), result, at: now }, ...previous] };
}
export function normalizeTasks(value) {
  return (Array.isArray(value) ? value : []).filter(item => item && typeof item.text === 'string').slice(0, 200).map((item, index) => ({
    ...item, id: typeof item.id === 'string' && item.id ? item.id : `legacy-task-${index}`,
    text: item.text.slice(0, 200), done: Boolean(item.done),
  }));
}
export function parseTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
export function timeString(minutes) {
  const value = Math.round(bounded(minutes, 0, 1439));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function normalizeLessons(value) {
  return (Array.isArray(value) ? value : []).filter(item => item && typeof item.name === 'string' && parseTime(item.time ?? item.startTime) !== null).slice(0, 100).map((item, index) => {
    const time = item.time ?? item.startTime, start = parseTime(time), candidate = parseTime(item.endTime);
    return { ...item, id: typeof item.id === 'string' && item.id ? item.id : `legacy-lesson-${index}`,
      name: item.name.slice(0, 80), place: safeText(item.place).slice(0, 80), day: Math.round(bounded(item.day, 0, 6)), time,
      endTime: candidate !== null && candidate > start ? item.endTime : timeString(Math.min(1439, start + 60)) };
  });
}
export function validateLesson(draft, lessons = [], editingId = null) {
  if (!safeText(draft.name).trim()) return 'name';
  const start = parseTime(draft.time), end = parseTime(draft.endTime);
  if (start === null || end === null || end <= start) return 'time';
  if (!Number.isInteger(Number(draft.day)) || Number(draft.day) < 0 || Number(draft.day) > 6) return 'day';
  if (!editingId && lessons.length >= 100) return 'limit';
  const collision = lessons.some(item => item.id !== editingId && Number(item.day) === Number(draft.day) && parseTime(item.time) < end && parseTime(item.endTime) > start);
  return collision ? 'overlap' : null;
}
export const TASK_UNIT_GROUPS = {
  length: { names: ['长度', 'Length'], units: [['mm','毫米','Millimetres',.001],['cm','厘米','Centimetres',.01],['m','米','Metres',1],['km','千米','Kilometres',1000],['in','英寸','Inches',.0254],['ft','英尺','Feet',.3048],['mi','英里','Miles',1609.344]] },
  weight: { names: ['重量', 'Weight'], units: [['g','克','Grams',.001],['kg','千克','Kilograms',1],['lb','磅','Pounds',.45359237],['oz','盎司','Ounces',.028349523125]] },
  temperature: { names: ['温度', 'Temperature'], units: [['c','摄氏度','Celsius',1],['f','华氏度','Fahrenheit',1],['k','开尔文','Kelvin',1]] },
  volume: { names: ['体积', 'Volume'], units: [['ml','毫升','Millilitres',.001],['l','升','Litres',1],['m3','立方米','Cubic metres',1000],['gal','美制加仑','US gallons',3.785411784]] },
  area: { names: ['面积', 'Area'], units: [['m2','平方米','Square metres',1],['km2','平方千米','Square kilometres',1000000],['ha','公顷','Hectares',10000],['ft2','平方英尺','Square feet',.09290304]] },
  time: { names: ['时间', 'Time'], units: [['s','秒','Seconds',1],['min','分钟','Minutes',60],['h','小时','Hours',3600],['d','天','Days',86400]] },
};
export const UNIT_SYMBOLS = { c:'°C', f:'°F', k:'K', m2:'m²', km2:'km²', ft2:'ft²', m3:'m³' };
export function convertTaskValue(value, category, from, to) {
  if (String(value).trim() === '') return { result: null, error: null };
  const n = Number(value), group = Object.hasOwn(TASK_UNIT_GROUPS,category) ? TASK_UNIT_GROUPS[category] : null;
  if (!Number.isFinite(n) || !group) return { result: null, error: 'number' };
  const a = group.units.find(item => item[0] === from), b = group.units.find(item => item[0] === to);
  if (!a || !b) return { result: null, error: 'unit' };
  if (category === 'temperature') {
    const c = from === 'f' ? (n - 32) * 5 / 9 : from === 'k' ? n - 273.15 : n;
    if (c < -273.1500001) return { result: null, error: 'absolute' };
    return { result: to === 'f' ? c * 9 / 5 + 32 : to === 'k' ? c + 273.15 : c, error: null };
  }
  const result = n * a[3] / b[3];
  return Number.isFinite(result) ? { result, error: null } : { result: null, error: 'number' };
}
export function formatTaskNumber(value, locale = 'zh-CN') {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e9 || (Math.abs(value) > 0 && Math.abs(value) < 1e-5)) return value.toExponential(4);
  return Number(value.toPrecision(10)).toLocaleString(locale, { maximumFractionDigits: 6 });
}
