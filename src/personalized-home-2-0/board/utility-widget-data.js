const HOUR = 60 * 60 * 1000;

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  return year >= 1900 && year <= 9999 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function normalizeCodexUsageConfig(config = {}, now = new Date()) {
  const source = config && typeof config === 'object' ? config : {};
  const percent = source.usedPercent === '' || source.usedPercent == null ? 47 : Number(source.usedPercent);
  const reset = new Date(Number.isFinite(now?.getTime?.()) ? now : Date.now());
  reset.setDate(reset.getDate() + 7);
  const timestamp = typeof source.updatedAt === 'string' && source.updatedAt ? new Date(source.updatedAt) : null;
  return {
    usedPercent: Number.isFinite(percent) ? Math.min(100, Math.max(0, Math.round(percent))) : 47,
    windowDays: 7,
    resetDate: validDate(source.resetDate) ? source.resetDate : localDate(reset),
    updatedAt: timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : '',
  };
}

export function normalizeWorkdayConfig(config = {}) {
  const source = config && typeof config === 'object' ? config : {};
  const startTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(source.startTime) ? source.startTime : '11:00';
  const duration = source.workHours === '' || source.workHours == null ? 8 : Number(source.workHours);
  return { startTime, workHours: Number.isFinite(duration) ? Math.min(16, Math.max(1, Math.round(duration * 2) / 2)) : 8 };
}

// Work duration is elapsed time. Local start times are reconstructed each day,
// so crossing midnight or a daylight-saving boundary never produces negatives.
export function getWorkdayCountdown(now = new Date(), config = {}) {
  const settings = normalizeWorkdayConfig(config);
  const current = new Date(Number.isFinite(now?.getTime?.()) ? now : Date.now());
  const [hours, minutes] = settings.startTime.split(':').map(Number);
  const start = new Date(current);
  start.setHours(hours, minutes, 0, 0);
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - 1);
  const previousEnd = new Date(previousStart.getTime() + settings.workHours * HOUR);
  const yesterdayRunsIntoToday = localDate(previousEnd) === localDate(current);
  let shiftStart = start;
  if (current < start && yesterdayRunsIntoToday) shiftStart = previousStart;
  const end = new Date(shiftStart.getTime() + settings.workHours * HOUR);
  const remainingSeconds = Math.max(0, Math.ceil((end.getTime() - current.getTime()) / 1000));
  const status = current >= end ? 'finished' : current < shiftStart ? 'upcoming' : 'working';
  return { remainingSeconds, status, start: shiftStart, end };
}

export function splitCountdown(seconds) {
  const safe = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  return [Math.floor(safe / 3600), Math.floor(safe / 60) % 60, safe % 60].map(value => String(value).padStart(2, '0'));
}

// One demand-driven clock, shared by document and viewport visibility changes.
// The next tick always derives from wall time rather than accumulating drift.
export function createVisibleClock({ onTick, now = () => Date.now(), schedule = setTimeout, cancel = clearTimeout }) {
  let visible = false;
  let disposed = false;
  let timer = null;
  function clear() {
    if (timer !== null) cancel(timer);
    timer = null;
  }
  function tick() {
    timer = null;
    if (!visible || disposed) return;
    const timestamp = now();
    onTick(timestamp);
    timer = schedule(tick, 1000 - timestamp % 1000);
  }
  return {
    setVisible(value) {
      const next = Boolean(value);
      if (disposed || next === visible) return;
      visible = next;
      clear();
      if (visible) tick();
    },
    dispose() { disposed = true; visible = false; clear(); },
  };
}
