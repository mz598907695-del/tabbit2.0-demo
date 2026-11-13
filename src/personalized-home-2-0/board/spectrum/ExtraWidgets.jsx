import { useEffect, useRef, useState } from 'react';
import { Globe2, Check, Droplets, BookOpen, Heart, Wind, Link2, Target, Wallet, Hourglass, Plus, Trash2, Sun, Moon, ArrowUpRight, Pencil, Download, RotateCcw, Play, Square } from 'lucide-react';
import { WidgetShell, Metric, WidgetButton, Field, DotMatrixNumber, DotGrid, useWidgetNow } from './UnifiedWidgetKit';
import { extraWidgetCatalog, WORLD_ZONES, WORLD_ZONE_EN, boundedNumber, localDay, parseDay, calendarDifference, weekStart, recentDays, habitStreak, safeLink, amountToCents, timeProgress, zoneTime, nextAnniversary, breathingState, expenseMonth, expensesCSV } from '../extra-widget-data';
import '../extra-widgets.css';
import './extra-v3.css';

export { extraWidgetCatalog };
const inputProps = { className: 'uw-input', 'data-board-interactive': true };
const uid = () => crypto.randomUUID();
const text = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object').slice(0, 200) : [];
const integer = (value, fallback, min, max) => Math.round(boundedNumber(value, fallback, min, max));
const words = locale => (zh, en) => locale.startsWith('en') ? en : zh;
const titleFor = (config, fallback, en, locale) => locale.startsWith('en') && config === fallback ? en : text(config, locale.startsWith('en') ? en : fallback);
const compactCount = value => {
  if (value < 1000) return value;
  const units = ['', 'k', 'M', 'B'];
  let unit = Math.min(units.length - 1, Math.floor(Math.log10(value) / 3));
  const scaled = value / 1000 ** unit;
  let rounded = Number(scaled.toFixed(scaled < 10 ? 1 : 0));
  if (rounded >= 1000 && unit < units.length - 1) { unit += 1; rounded /= 1000; }
  return rounded + units[unit];
};
const artwork = name => '/personalized-home-2-0/asset/widgets/editorial/' + name + '.webp';
function EditorialArt({ name, className = '' }) { return <img className={'extra-editorial-art ' + className} src={artwork(name)} alt="" aria-hidden="true" draggable="false" decoding="async"/>; }
function MiniButton({ children, ...props }) { return <WidgetButton className="extra-mini-button" {...props}>{children}</WidgetButton>; }
function IconButton({ children, label, ...props }) { return <WidgetButton className="extra-icon-button" aria-label={label} title={label} {...props}>{children}</WidgetButton>; }
function CapsuleTrack({ value, max = 100, label, segments = 16, className = '' }) {
  const ratio = Math.max(0, Math.min(1, Number(value) / (Number(max) || 1)));
  return <div className={'nv-capsule-track ' + className} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, Number(value) || 0))}>
    {Array.from({ length: segments }, (_, i) => <i key={i} className={(i + .5) / segments <= ratio ? 'is-filled' : ''}/>)}
  </div>;
}
function ExpenseDotChart({ values, currentDay, label, format }) {
  const ceiling = Math.max(1, ...values), step = 9;
  return <svg className="extra-expense-dot-chart nv-expense-bars" viewBox={`0 0 ${values.length * step} 64`} preserveAspectRatio="none" role="img" aria-label={label}>
    {values.map((value, day) => { const height = value ? Math.max(5, value / ceiling * 54) : 2; return <g key={day} className={day + 1 === currentDay ? 'is-today' : ''}><title>{`${day + 1}: ${format(value)}`}</title><rect x={day * step + 2} y={60 - height} width="5" height={height} rx="2.5" className={value ? 'is-filled' : ''}/></g>; })}
  </svg>;
}
function BreathWave({ expansion, running, label }) {
  const amplitude = running ? 8 + expansion * 21 : 15;
  return <svg className="nv-breath-wave" viewBox="0 0 220 70" role="img" aria-label={label}>
    {Array.from({ length: 23 }, (_, i) => { const height = 4 + Math.sin((i + 1) / 24 * Math.PI) ** 2 * amplitude; return <path key={i} d={`M${i * 9 + 11} ${35 - height}V${35 + height}`} opacity={.28 + Math.sin((i + 1) / 24 * Math.PI) * .72}/>; })}
  </svg>;
}
function useSyncedDraft(value) {
  const [draft, setDraft] = useState(value);
  const previous = useRef(value);
  useEffect(() => {
    const oldValue = previous.current;
    previous.current = value;
    setDraft(current => current === oldValue ? value : current);
  }, [value]);
  return [draft, setDraft];
}
function useSavedChange(onChange, locale) {
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const save = patch => { if (!onChange) return; onChange(patch); setSaved(true); clearTimeout(timer.current); timer.current = setTimeout(() => setSaved(false), 1800); };
  return [save, saved ? <p className="uw-muted extra-save-feedback" role="status">{words(locale)('已保存', 'Saved')}</p> : null];
}
function ClockFace({ hour, minute, daytime }) {
  return <svg className={'extra-clock-face' + (daytime ? '' : ' is-night')} viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="18.5" />
    {Array.from({ length: 24 }, (_, i) => <path key={i} d={i % 6 === 0 ? 'M20 3.8v2.6' : 'M20 4.3v1.1'} transform={'rotate(' + i * 15 + ' 20 20)'} className={'extra-clock-tick' + (i % 6 === 0 ? ' is-quarter' : '')}/>)}
    <path d="M20 20V11" transform={'rotate(' + (hour % 12 * 30 + minute / 2) + ' 20 20)'} className="extra-clock-hour"/>
    <path d="M20 20V7" transform={'rotate(' + minute * 6 + ' 20 20)'} />
    <circle cx="20" cy="20" r="1.3" className="extra-clock-center"/>
  </svg>;
}
function WorldClock({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 1000);
  const known = WORLD_ZONES.map(z => z[0]);
  const zones = Array.isArray(config.zones) ? [...new Set(config.zones.filter(z => known.includes(z)))].slice(0, 5) : ['Asia/Shanghai', 'Europe/London', 'America/New_York'];
  const effective = zones.length ? zones : ['Asia/Shanghai'];
  const name = z => { const i = known.indexOf(z); return locale.startsWith('en') ? WORLD_ZONE_EN[i] : WORLD_ZONES[i]?.[1]; };
  const date = z => new Intl.DateTimeFormat(locale, { timeZone: z, month: 'short', day: 'numeric', weekday: 'short' }).format(now);
  const [selected, setSelected] = useState(effective);
  const [save, feedback] = useSavedChange(onChange, locale);
  const first = zoneTime(effective[0], now, locale);
  return <WidgetShell title={t('世界时钟', 'World clock')} icon={<Globe2/>} preview={preview} className="extra-world"
    footer={date(effective[0])}
    details={<div className="uw-stack"><section className="uw-detail-section"><div className="extra-zone-list">{effective.map(z => { const time = zoneTime(z, now, locale); return <div className="extra-zone-row" key={z}><ClockFace {...time}/><div><strong>{name(z)}</strong><small>{date(z)}</small></div><b>{time.time}</b><span className="extra-city-phase" title={time.daytime ? t('日间', 'Daytime') : t('夜间', 'Nighttime')}>{time.daytime ? <Sun size={14}/> : <Moon size={14}/>}</span></div>; })}</div></section>
      <section className="uw-detail-section"><fieldset className="extra-zone-fieldset"><legend>{t('显示城市（最多 5 个）', 'Cities (up to 5)')}</legend><div className="extra-zone-options">{WORLD_ZONES.map(([z]) => <label key={z}><input type="checkbox" checked={selected.includes(z)} disabled={!selected.includes(z) && selected.length >= 5} onChange={e => setSelected(current => e.target.checked ? [...current, z] : current.filter(v => v !== z))}/>{name(z)}</label>)}</div></fieldset><WidgetButton disabled={!selected.length} onClick={() => save({ zones: selected })}>{t('保存城市', 'Save cities')}</WidgetButton>{feedback}</section></div>}>
    <div className="extra-world-primary nv-world-primary"><div><span className="extra-eyebrow">{name(effective[0])} {first.daytime ? <Sun size={12}/> : <Moon size={12}/>}</span><div className="extra-world-value"><DotMatrixNumber value={first.time}/><span className="extra-world-tiny-time">{first.time.slice(0, 3)}<wbr/>{first.time.slice(3)}</span></div></div></div><div className="nv-world-track"><CapsuleTrack value={first.hour + first.minute / 60} max={24} segments={24} label={t('当地一天的进度', 'Local day progress')}/><div className="nv-scale-labels"><span>00</span><span>12</span><span>24</span></div></div>
    <div className="extra-world-cities">{effective.slice(1).map(z => { const time = zoneTime(z, now, locale); return <div key={z}><span className="extra-city-heading"><span>{name(z)}</span><span className="extra-city-phase" title={time.daytime ? t('日间', 'Daytime') : t('夜间', 'Nighttime')}>{time.daytime ? <Sun size={10}/> : <Moon size={10}/>}</span></span><b>{time.time}</b></div>; })}</div>
  </WidgetShell>;
}
function Habits({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 60000), today = localDay(now);
  const dates = Array.isArray(config.dates) ? [...new Set(config.dates.filter(d => parseDay(d)))].sort().slice(-3660) : [];
  const done = dates.includes(today), streak = habitStreak(dates, now), name = titleFor(config.name, '阅读 20 分钟', 'Read for 20 minutes', locale);
  const [draft, setDraft] = useSyncedDraft(name), [save, feedback] = useSavedChange(onChange, locale);
  const days = recentDays(now, 7);
  const toggle = () => onChange?.({ dates: done ? dates.filter(d => d !== today) : [...dates, today].sort().slice(-3660) });
  const history = <div className="extra-habit-history">{recentDays(now, 84).map(d => <span key={d} className={dates.includes(d) ? 'is-done' : ''} title={d + (dates.includes(d) ? t(' · 已完成', ' · Done') : '')}>{d.slice(-2)}</span>)}</div>;
  return <WidgetShell title={t('习惯打卡', 'Habit tracker')} icon={<Check/>} preview={preview} className="extra-habits extra-focus"
    details={<div className="uw-stack"><section className="uw-detail-section"><div className="uw-detail-summary"><span className="uw-detail-caption">{name}</span><Metric value={streak} unit={t('天连续', 'day streak')}/></div><WidgetButton onClick={toggle}>{done ? <Check size={14}/> : <Plus size={14}/>}{done ? t('撤销今日打卡', 'Undo today') : t('完成今日打卡', 'Check in today')}</WidgetButton></section><section className="uw-detail-section"><h3>{t('最近 12 周', 'Last 12 weeks')}</h3>{history}<p className="uw-detail-caption">{t('已记录 ', 'Logged ')}{dates.length}{t(' 天', ' days')}</p></section><section className="uw-detail-section"><Field label={t('我的习惯', 'My habit')}><input {...inputProps} value={draft} maxLength={60} onChange={e => setDraft(e.target.value)}/></Field><WidgetButton disabled={!draft.trim()} onClick={() => save({ name: draft.trim() })}>{t('保存习惯', 'Save habit')}</WidgetButton>{feedback}</section></div>}>
    <div className="extra-focus-face extra-habit-face">
      <p className="extra-focus-name" title={name}>{name}</p>
      <div className="extra-habit-current"><div className="extra-focus-number"><DotMatrixNumber value={streak}/><span className="extra-focus-micro-value" role="img" aria-label={String(streak)} title={String(streak)}>{compactCount(streak)}</span><small><span className="extra-focus-unit-full">{t('天连续', 'day streak')}</span><span className="extra-focus-unit-short">{t('天', 'days')}</span></small></div><MiniButton disabled={preview} aria-label={done ? t('撤销今日打卡', 'Undo today') : t('完成今日打卡', 'Check in today')} aria-pressed={done} onClick={toggle}>{done ? <Check size={13}/> : <Plus size={13}/>}<span>{done ? t('已打卡', 'Done') : t('打卡', 'Check in')}</span></MiniButton></div>
      <div className="extra-habit-week nv-habit-rail" aria-label={t('近 7 天打卡记录', 'Check-ins over the last 7 days')}>{days.map(day => <span key={day} className={dates.includes(day) ? 'is-done' : ''} title={day + (dates.includes(day) ? t(' · 已打卡', ' · Done') : t(' · 未打卡', ' · Not checked in'))}><i aria-hidden="true"/><small>{new Date(day + 'T12:00:00').toLocaleDateString(locale, { weekday: 'narrow' })}</small></span>)}</div>
    </div>
  </WidgetShell>;
}
function Hydration({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 10000), today = localDay(now);
  const goal = integer(config.goal, 8, 1, 30), count = config.date === today ? integer(config.count, 0, 0, 100) : 0;
  const interval = integer(config.intervalMinutes, 60, 15, 240), last = boundedNumber(config.lastDrink, 0, 0, Date.now());
  const due = count < goal && (!last || +now - last >= interval * 60000);
  const wait = Math.max(1, Math.ceil((interval * 60000 - (+now - last)) / 60000));
  const [goalDraft, setGoalDraft] = useState(goal), [intervalDraft, setIntervalDraft] = useState(interval);
  const [save, feedback] = useSavedChange(onChange, locale);
  const change = delta => onChange?.({ count: Math.max(0, Math.min(100, count + delta)), date: today, ...(delta > 0 ? { lastDrink: Date.now() } : {}) });
  const message = count >= goal ? t('今日目标已完成', 'Daily goal reached') : due ? t('该喝杯水了', 'Time for a glass of water') : t('下次提醒 ', 'Next reminder in ') + wait + t(' 分钟', ' min');
  const progress = Math.min(100, Math.round(count / goal * 100));
  const progressBar = <div className="extra-water-progress" role="meter" aria-label={t('今日喝水目标', 'Daily hydration goal')} aria-valuenow={Math.min(count, goal)} aria-valuemin={0} aria-valuemax={goal} aria-valuetext={count + ' / ' + goal + t(' 杯', ' glasses')}><i style={{ width: progress + '%' }}/></div>;
  return <WidgetShell title={t('喝水提醒', 'Hydration')} icon={<Droplets/>} preview={preview} className="extra-hydration extra-focus"
    details={<div className="uw-stack"><section className="uw-detail-section"><div className="uw-detail-summary extra-hydration-summary"><div><span className="uw-detail-caption">{t('今天已喝', 'Today so far')}</span><Metric value={count * 250} unit="mL"/><p>{count} / {goal} {t('杯', 'glasses')} · {progress}%</p></div><EditorialArt name="water-glass"/></div>{progressBar}<p className="uw-muted" role="status">{message}</p><div className="uw-row"><WidgetButton disabled={count >= 100} onClick={() => change(1)}><Plus size={14}/>{t('喝了一杯', 'Add a glass')}</WidgetButton><WidgetButton disabled={!count} onClick={() => change(-1)}><RotateCcw size={14}/>{t('撤销一杯', 'Undo a glass')}</WidgetButton></div></section><section className="uw-detail-section"><h3>{t('目标与提醒', 'Goal & reminders')}</h3><div className="uw-grid"><Field label={t('每日目标（杯）', 'Daily goal (glasses)')}><input {...inputProps} type="number" min="1" max="30" value={goalDraft} onChange={e => setGoalDraft(e.target.value)}/></Field><Field label={t('提醒间隔（分钟）', 'Interval (minutes)')}><input {...inputProps} type="number" min="15" max="240" value={intervalDraft} onChange={e => setIntervalDraft(e.target.value)}/></Field></div><WidgetButton onClick={() => { const nextGoal = integer(goalDraft, 8, 1, 30), nextInterval = integer(intervalDraft, 60, 15, 240); setGoalDraft(nextGoal); setIntervalDraft(nextInterval); save({ goal: nextGoal, intervalMinutes: nextInterval }); }}>{t('保存设置', 'Save settings')}</WidgetButton>{feedback}<p className="uw-detail-caption">{t('每杯按 250 mL 记录。提醒在首页打开时显示，跨日自动重新计数。', 'Each glass is 250 mL. Reminders appear while the homepage is open; counts reset each day.')}</p></section></div>}>
    <div className="extra-focus-face extra-hydration-face">
      <div className="extra-hydration-current"><div className="extra-focus-number"><DotMatrixNumber value={count}/><span className="extra-focus-micro-value" role="img" aria-label={String(count)} title={String(count)}>{count}</span><small>/ {goal} {t('杯', 'glasses')}</small></div><EditorialArt name="water-glass"/></div>
      <CapsuleTrack value={count} max={goal} segments={Math.min(goal, 16)} label={t('喝水目标', 'Hydration goal')}/><div className="extra-hydration-action"><MiniButton disabled={preview || count >= 100} aria-label={t('喝了一杯水', 'Add a glass of water')} onClick={() => change(1)}><Plus size={13}/><span>{t('一杯水', 'One glass')}</span></MiniButton><span className="extra-focus-caption" role="status">{message}</span></div>
    </div>
  </WidgetShell>;
}
function Reading({ config, onChange, preview, locale }) {
  const t = words(locale), total = integer(config.total, 300, 1, 100000), page = integer(config.page, 0, 0, total), book = text(config.book);
  const [draft, setDraft] = useState({ book, total, page }), [save, feedback] = useSavedChange(onChange, locale), [detailOpen, setDetailOpen] = useState(false);
  useEffect(() => setDraft({ book, total, page }), [book, total, page]);
  const progress = Math.round(page / total * 100);
  return <WidgetShell title={t('阅读进度', 'Reading')} icon={<BookOpen/>} preview={preview} className="extra-reading extra-focus" detailOpen={detailOpen} onDetailOpenChange={setDetailOpen}
    details={<div className="uw-stack"><section className="uw-detail-section"><div className="uw-detail-summary extra-reading-summary"><EditorialArt name="reading-book"/><div><span className="uw-detail-caption">{t('正在阅读', 'Currently reading')}</span><h3>{book || t('下一本好书', 'Your next good book')}</h3><Metric value={page} unit={'/ ' + total + t(' 页', ' pages')}/><p className="uw-muted">{progress}% · {t('还剩 ', '')}{total - page}{t(' 页', ' pages left')}</p></div></div></section><form className="uw-detail-section" onSubmit={e => { e.preventDefault(); const next = integer(draft.total, total, 1, 100000); save({ book: draft.book.trim(), total: next, page: integer(draft.page, 0, 0, next) }); }}><h3>{t('更新阅读记录', 'Update your reading')}</h3><Field label={t('书名', 'Book title')}><input {...inputProps} value={draft.book} maxLength={120} placeholder={t('写下书名', 'Enter a book title')} onChange={e => setDraft({ ...draft, book: e.target.value })}/></Field><div className="uw-grid"><Field label={t('读到第几页', 'Current page')}><input {...inputProps} type="number" min="0" max={draft.total} value={draft.page} onChange={e => setDraft({ ...draft, page: e.target.value })}/></Field><Field label={t('总页数', 'Total pages')}><input {...inputProps} type="number" min="1" max="100000" value={draft.total} onChange={e => setDraft({ ...draft, total: e.target.value })}/></Field></div><WidgetButton type="submit">{t('保存进度', 'Save progress')}</WidgetButton>{feedback}</form></div>}>
    <div className="extra-focus-face extra-reading-face" data-reading-state={book ? (page >= total ? 'finished' : 'reading') : 'empty'}>
      <EditorialArt name="reading-book"/><p className="extra-focus-name" title={book || t('下一本好书', 'Your next good book')}>{book || t('下一本好书', 'Your next good book')}</p>
      <div className="extra-reading-current"><div className="extra-focus-number"><DotMatrixNumber value={page}/><span className="extra-focus-micro-value" role="img" aria-label={String(page)} title={String(page)}>{compactCount(page)}</span><small>/ {total}<span className="extra-focus-unit"> {t('页', 'pages')}</span></small></div><MiniButton disabled={preview || (Boolean(book) && page >= total)} aria-label={book ? t('读完下一页', 'Read the next page') : t('添加书籍', 'Add a book')} onClick={() => book ? onChange?.({ page: Math.min(total, page + 1) }) : setDetailOpen(true)}>{book ? '+1' : <Plus size={13}/>}</MiniButton></div><div className="nv-reading-track"><CapsuleTrack value={page} max={total} segments={18} label={t('阅读进度', 'Reading progress')}/><span>{t('还剩 ', '')}{total - page}{t(' 页', ' pages left')}</span></div>
    </div>
  </WidgetShell>;
}
function Anniversary({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 60000), date = parseDay(config.date), difference = calendarDifference(config.date, now), next = nextAnniversary(config.date, now);
  const name = titleFor(config.name, '值得纪念的一天', 'A day to remember', locale);
  const [draftName, setName] = useSyncedDraft(name), [draftDate, setDate] = useSyncedDraft(text(config.date)), [save, feedback] = useSavedChange(onChange, locale), [detailOpen, setDetailOpen] = useState(false);
  return <WidgetShell title={t('纪念日', 'Anniversary')} icon={<Heart/>} preview={preview} className="extra-anniversary extra-focus" detailOpen={detailOpen} onDetailOpenChange={setDetailOpen}
    details={<div className="uw-stack">{date && <section className="uw-detail-section"><div className="uw-detail-summary"><span className="uw-detail-caption">{name}</span><Metric value={Math.abs(difference)} unit={difference < 0 ? t('天后', 'days to go') : t('天相伴', 'days together')}/><p className="uw-muted">{date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>{difference >= 0 && <p className="uw-detail-caption">{next?.days === 0 ? t('今天就是纪念日', 'Today is the anniversary') : t('下个纪念日还有 ', 'Next anniversary in ') + next?.days + t(' 天', ' days')}</p>}</div></section>}<form className="uw-detail-section" onSubmit={e => { e.preventDefault(); if (parseDay(draftDate)) save({ name: draftName.trim() || t('值得纪念的一天', 'A day to remember'), date: draftDate }); }}><h3>{t('记录重要的日子', 'A date to remember')}</h3><Field label={t('纪念什么', 'What are you celebrating?')}><input {...inputProps} value={draftName} maxLength={80} onChange={e => setName(e.target.value)}/></Field><Field label={t('日期', 'Date')}><input {...inputProps} type="date" value={draftDate} required onChange={e => setDate(e.target.value)}/></Field><WidgetButton type="submit">{t('保存日期', 'Save date')}</WidgetButton>{feedback}</form></div>}>
    <div className="extra-focus-face extra-anniversary-face" data-long-number={difference !== null && Math.abs(difference) >= 100000}>
      <div className="nv-anniversary-mark"><Heart size={22} strokeWidth={1.4}/>{date && <span>{date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span>}</div><p className="extra-focus-name" title={name}>{name}</p><div className="extra-focus-number"><DotMatrixNumber value={difference === null ? '—' : Math.abs(difference)}/><span className="extra-focus-micro-value" role="img" aria-label={difference === null ? '—' : String(Math.abs(difference))} title={difference === null ? '—' : String(Math.abs(difference))}>{difference === null ? '—' : compactCount(Math.abs(difference))}</span><small><span className="extra-focus-unit-full">{difference === null ? t('待设置', 'Set a date') : difference < 0 ? t('天后', 'days to go') : difference === 0 ? t('就是今天', 'Today') : t('天相伴', 'days together')}</span><span className="extra-focus-unit-short">{difference === null ? t('待设置', 'Set date') : difference === 0 ? t('今天', 'Today') : difference < 0 ? t('天后', 'days') : t('天', 'days')}</span></small></div>
      {date ? <time className="extra-focus-caption" dateTime={config.date}>{date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}</time> : <MiniButton disabled={preview} onClick={() => setDetailOpen(true)}>{t('设置日期', 'Set date')}</MiniButton>}
    </div>
  </WidgetShell>;
}
function Breathing({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 100), start = boundedNumber(config.startedAt, 0, 0, Date.now());
  const state = breathingState(start, +now), completedRef = useRef(0), [completed, setCompleted] = useState(false);
  useEffect(() => {
    if (!active || preview || !state.complete || completedRef.current === start) return;
    completedRef.current = start; setCompleted(true);
    onChange?.({ startedAt: 0, sessions: integer(config.sessions, 0, 0, 1000000) + 1, lastSession: localDay(new Date()) });
  }, [state.complete, start, active, preview, onChange, config.sessions]);
  const toggle = () => { setCompleted(false); onChange?.({ startedAt: state.running ? 0 : Date.now() }); };
  const phase = state.running ? (state.inhale ? t('吸气', 'Breathe in') : t('呼气', 'Breathe out')) : completed ? t('完成', 'Complete') : t('慢下来', 'Slow down');
  const dial = <div className="extra-breath-dial nv-breath-dial"><div className="nv-breath-value"><DotMatrixNumber className="extra-breath-number" value={state.running ? state.remaining : '60'}/><span className="extra-breath-phase">{phase}</span></div><BreathWave running={state.running} expansion={state.expansion} label={t('呼吸节奏：', 'Breathing rhythm: ') + phase}/><CapsuleTrack value={state.running ? state.elapsed : 0} max={60} segments={6} className="nv-session-progress" label={t('一分钟练习进度', 'One minute session progress')}/></div>;
  return <WidgetShell title={t('呼吸练习', 'Breathe')} icon={<Wind/>} preview={preview} className="extra-breathing"
    footer={<span className="extra-between"><span>{t('吸气 4 秒 · 呼气 6 秒', '4s in · 6s out')}</span><span>{integer(config.sessions, 0, 0, 1000000)}{t(' 次', ' sessions')}</span></span>}
    details={<div className="uw-stack"><div className="extra-breath-detail">{dial}</div><p role="status">{state.running ? phase : t('一分钟，六次呼吸。按自己的节奏，随时可以停止。', 'One minute, six breaths. Follow your own pace and stop whenever you like.')}</p><WidgetButton onClick={toggle}>{state.running ? t('结束练习', 'Stop session') : t('开始一分钟', 'Start one minute')}</WidgetButton><p className="uw-muted">{t('完成整段练习会自动记录次数；刷新后会根据开始时间继续。', 'Completed sessions are counted automatically. Refreshing preserves your session timer.')}</p></div>}>
    {dial}<MiniButton disabled={preview} aria-label={state.running ? t('结束呼吸练习', 'Stop breathing session') : t('开始一分钟呼吸练习', 'Start one minute of breathing')} onClick={toggle}>{state.running ? <Square size={11}/> : <Play size={11}/>}<span>{state.running ? t('结束', 'Stop') : t('开始一分钟', 'Start a minute')}</span></MiniButton>
  </WidgetShell>;
}
function QuickLinks({ config, onChange, preview, locale }) {
  const t = words(locale), links = list(config.links).filter(item => safeLink(item.url)).slice(0, 20);
  const [label, setLabel] = useState(''), [url, setUrl] = useState(''), [error, setError] = useState(''), [editing, setEditing] = useState(-1), [detailOpen, setDetailOpen] = useState(false);
  const name = item => text(item.label) || new URL(safeLink(item.url)).hostname;
  const add = e => { e.preventDefault(); const href = safeLink(url.trim()); if (!href) { setError(t('请输入有效的 HTTP 或 HTTPS 网址。', 'Enter a valid HTTP or HTTPS URL.')); return; } const entry = { id: links[editing]?.id || uid(), label: label.trim() || new URL(href).hostname, url: href }; onChange?.({ links: editing >= 0 ? links.map((item, i) => i === editing ? entry : item) : [...links, entry] }); setLabel(''); setUrl(''); setEditing(-1); setError(''); };
  const open = (item, i) => <a key={item.id || i} data-board-interactive="true" href={preview ? undefined : safeLink(item.url)} target="_blank" rel="noopener noreferrer" title={safeLink(item.url)} tabIndex={preview ? -1 : 0}><span className="extra-site-letter" aria-hidden="true"><span className="extra-site-monogram">{name(item).slice(0, 1).toUpperCase()}</span><span className="extra-site-rank">{String(i + 1).padStart(2, '0')}</span></span><span><b>{name(item)}</b><small>{new URL(safeLink(item.url)).hostname.replace(/^www\./, '')}</small></span><ArrowUpRight size={13}/></a>;
  return <WidgetShell title={t('快捷链接', 'Quick links')} icon={<Link2/>} preview={preview} className="extra-links" detailOpen={detailOpen} onDetailOpenChange={setDetailOpen} footer={links.length + t(' 个常用网站', ' saved websites')}
    details={<div className="uw-stack"><div className="extra-links-edit">{links.map((item, i) => <div key={item.id || i}>{open(item, i)}<IconButton label={t('编辑 ', 'Edit ') + name(item)} onClick={() => { setEditing(i); setLabel(name(item)); setUrl(item.url); }}><Pencil size={13}/></IconButton><IconButton label={t('删除 ', 'Delete ') + name(item)} onClick={() => { onChange?.({ links: links.filter((_, n) => n !== i) }); if (editing === i) { setEditing(-1); setLabel(''); setUrl(''); setError(''); } else if (editing > i) setEditing(editing - 1); }}><Trash2 size={13}/></IconButton></div>)}</div>{(links.length < 20 || editing >= 0) && <form className="uw-detail-section" onSubmit={add}><h3>{editing >= 0 ? t('编辑链接', 'Edit link') : t('添加链接', 'Add a link')}</h3><Field label={t('名称', 'Name')}><input {...inputProps} value={label} maxLength={60} onChange={e => setLabel(e.target.value)}/></Field><Field label={t('网址', 'URL')}><input {...inputProps} value={url} maxLength={2000} required onChange={e => setUrl(e.target.value)} placeholder="https://"/></Field><div className="uw-row"><WidgetButton type="submit">{editing >= 0 ? t('保存修改', 'Save changes') : t('添加链接', 'Add link')}</WidgetButton>{editing >= 0 && <WidgetButton onClick={() => { setEditing(-1); setLabel(''); setUrl(''); }}>{t('取消', 'Cancel')}</WidgetButton>}</div>{error && <p role="status">{error}</p>}</form>}</div>}>
    {links.length ? <div className="extra-links-list">{links.map(open)}</div> : <div className="extra-empty"><Link2 size={30} strokeWidth={1.2}/><strong>{t('常去的地方，一步直达', 'Your places, one click away')}</strong><MiniButton disabled={preview} aria-label={t('添加网站', 'Add website')} onClick={() => setDetailOpen(true)}><Plus size={13}/><span>{t('添加网站', 'Add website')}</span></MiniButton></div>}
  </WidgetShell>;
}
function WeeklyGoals({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 60000), week = weekStart(now), goals = list(config.goals).slice(0, 12);
  const [draft, setDraft] = useState(''), [adding, setAdding] = useState(false), inputRef = useRef(null), addRef = useRef(null), done = goals.filter(g => g.done).length;
  useEffect(() => { if (adding) inputRef.current?.focus({ preventScroll: true }); }, [adding]);
  const update = next => onChange?.({ goals: next, week: config.week || week });
  const toggle = index => update(goals.map((goal, i) => i === index ? { ...goal, done: !goal.done } : goal));
  const add = (e, inline) => { e.preventDefault(); if (draft.trim() && goals.length < 12) { update([...goals, { id: uid(), text: draft.trim(), done: false }]); setDraft(''); if (inline) { setAdding(false); requestAnimationFrame(() => addRef.current?.focus({ preventScroll: true })); } } };
  const form = (inline = false) => <form className={inline ? "extra-goal-compose" : "extra-goal-add"} onSubmit={e => add(e, inline)} onKeyDown={e => { if (inline && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setAdding(false); requestAnimationFrame(() => addRef.current?.focus({ preventScroll: true })); } }}><input {...inputProps} ref={inline ? inputRef : undefined} disabled={preview} aria-label={t('新的本周目标', 'New weekly goal')} placeholder={t('添加一个目标', 'Add a goal')} value={draft} maxLength={120} onChange={e => setDraft(e.target.value)}/><IconButton disabled={preview || !draft.trim() || goals.length >= 12} type="submit" label={t('添加目标', 'Add goal')}><Plus size={14}/></IconButton></form>;
  const rows = editable => goals.map((goal, i) => <div className={editable ? "extra-goal-row" : "extra-goal-card-row"} key={goal.id || i}><label><input type="checkbox" data-board-interactive="true" checked={goal.done === true} aria-label={t('完成目标 ', 'Complete goal ') + text(goal.text)} disabled={preview} onChange={() => toggle(i)}/>{editable ? <input className={goal.done ? 'is-done' : ''} aria-label={t('目标内容', 'Goal text')} value={text(goal.text)} maxLength={120} onChange={e => update(goals.map((g, n) => n === i ? { ...g, text: e.target.value } : g))}/> : <span className={goal.done ? 'is-done' : ''} title={text(goal.text)}>{text(goal.text)}</span>}</label>{editable && <IconButton label={t('删除目标 ', 'Delete goal ') + text(goal.text)} onClick={() => update(goals.filter((_, n) => n !== i))}><Trash2 size={13}/></IconButton>}</div>);
  return <WidgetShell title={t('本周目标', 'Weekly goals')} icon={<Target/>} preview={preview} className="extra-goals extra-focus"
    details={<div className="uw-stack"><p className="uw-muted">{config.week || week}{t(' 开始的一周', ' · week beginning')}</p><div className="extra-goal-list">{rows(true)}</div>{form()}{config.week !== week && <WidgetButton onClick={() => onChange?.({ week, goals: goals.map(goal => ({ ...goal, done: false })) })}>{t('保留目标，开始新一周', 'Keep goals, start a new week')}</WidgetButton>}</div>}>
    <div className="extra-focus-face extra-goals-face">
      <div className="extra-goal-summary"><span className="extra-focus-number"><DotMatrixNumber value={done}/><span className="extra-focus-micro-value" role="img" aria-label={String(done)} title={String(done)}>{done}</span><small>/ {goals.length}</small></span><span className="extra-focus-caption">{config.week && config.week !== week ? t('上一周', 'Previous week') : t('已完成', 'completed')}</span><CapsuleTrack value={done} max={goals.length || 1} segments={Math.max(goals.length, 3)} label={t('本周目标完成度', 'Weekly goal completion')}/></div>
      <div className="extra-goal-card-list">{goals.length ? rows(false) : <p className="extra-focus-caption">{t('这周，专注几件重要的事。', 'A few things that matter this week.')}</p>}</div>
      <div className="extra-goal-entry">{adding ? form(true) : <button ref={addRef} type="button" className="extra-goal-create" data-board-interactive="true" disabled={preview || goals.length >= 12} onClick={() => setAdding(true)}><Plus size={13}/>{t('添加目标', 'Add a goal')}</button>}<span className="extra-focus-caption">{config.week && config.week !== week && <>{t('上一周', 'Previous week')} · </>}{done}/{goals.length}</span></div>
    </div>
  </WidgetShell>;
}
function Expenses({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 60000), month = localDay(now).slice(0, 7);
  const entries = list(config.entries).filter(entry => parseDay(entry.date) && Number.isSafeInteger(entry.cents) && entry.cents > 0);
  const summary = expenseMonth(entries, month), [amount, setAmount] = useState(''), [label, setLabel] = useState(''), [date, setDate] = useState(localDay()), [error, setError] = useState(''), [editing, setEditing] = useState(null), [showAll, setShowAll] = useState(false), [quickAmount, setQuickAmount] = useState(''), [quickError, setQuickError] = useState('');
  const money = cents => (cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const add = e => { e.preventDefault(); const cents = amountToCents(amount); if (!cents || !parseDay(date)) { setError(t('填写有效日期和大于 0 的金额，最多两位小数。', 'Use a valid date and a positive amount with up to two decimals.')); return; } const next = { id: editing || uid(), label: label.trim() || t('日常支出', 'Daily expense'), cents, date }; onChange?.({ entries: (editing ? entries.map(entry => entry.id === editing ? next : entry) : [...entries, next]).slice(-200) }); setAmount(''); setLabel(''); setDate(localDay()); setEditing(null); setError(''); };
  const addQuick = e => {
    e.preventDefault();
    const cents = amountToCents(quickAmount);
    if (!cents) { setQuickError(t('金额须大于 0，最多两位小数。', 'Use a positive amount with up to two decimals.')); return; }
    onChange?.({ entries: [...entries, { id: uid(), label: t('日常支出', 'Daily expense'), cents, date: localDay() }].slice(-200) });
    setQuickAmount(''); setQuickError('');
  };
  const exportCSV = () => { const url = URL.createObjectURL(new Blob([expensesCSV(showAll ? entries : summary.entries, locale)], { type: 'text/csv;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'expenses-' + (showAll ? 'all' : month) + '.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const currentEntries = (showAll ? entries : summary.entries).slice().reverse();
  const yuan = summary.total / 100, metric = yuan >= 100000 ? yuan.toLocaleString(locale, { notation: 'compact', maximumFractionDigits: 1 }) : money(summary.total);
  const quick = <form className="extra-expense-quick" onSubmit={addQuick}><span>¥</span><input {...inputProps} aria-label={t('支出金额', 'Expense amount')} inputMode="decimal" placeholder="0.00" value={quickAmount} maxLength={12} disabled={preview} onChange={e => { setQuickAmount(e.target.value); setQuickError(''); }}/><IconButton type="submit" disabled={preview || !quickAmount.trim()} label={t('记一笔支出', 'Add an expense')}><Plus size={14}/></IconButton></form>;
  return <WidgetShell title={t('记账本', 'Expenses')} icon={<Wallet/>} preview={preview} className="extra-expenses"
    footer={<span className="extra-between"><span>{now.toLocaleDateString(locale, { month: 'long' })}</span><span>{summary.entries.length}{t(' 笔支出', ' expenses')}</span></span>}
    details={<div className="uw-stack"><Metric value={money(summary.total)} unit={t('元 · 本月', 'CNY · this month')}/><form className="uw-stack" onSubmit={add}><div className="uw-grid"><Field label={t('金额（元）', 'Amount (CNY)')}><input {...inputProps} inputMode="decimal" placeholder="0.00" value={amount} maxLength={12} required onChange={e => setAmount(e.target.value)}/></Field><Field label={t('日期', 'Date')}><input {...inputProps} type="date" required value={date} onChange={e => setDate(e.target.value)}/></Field></div><Field label={t('用途', 'Description')}><input {...inputProps} placeholder={t('这笔钱花在哪里', 'What was it for?')} value={label} maxLength={60} onChange={e => setLabel(e.target.value)}/></Field><div className="uw-row"><WidgetButton type="submit">{editing ? t('保存修改', 'Save changes') : t('记一笔', 'Add expense')}</WidgetButton>{editing && <WidgetButton onClick={() => { setEditing(null); setAmount(''); setLabel(''); setDate(localDay()); setError(''); }}>{t('取消', 'Cancel')}</WidgetButton>}</div>{error && <p role="status">{error}</p>}</form><div className="extra-between"><WidgetButton aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? t('查看本月', 'This month') : t('查看全部', 'All records')}</WidgetButton><WidgetButton disabled={!currentEntries.length} onClick={exportCSV}><Download size={13}/>{t('导出 CSV', 'Export CSV')}</WidgetButton></div><div className="extra-expense-list">{currentEntries.map((entry, i) => <div key={entry.id || i}><div><span>{text(entry.label, t('日常支出', 'Daily expense'))}</span><small>{entry.date}</small></div><strong>¥{money(entry.cents)}</strong><IconButton label={t('编辑 ', 'Edit ') + text(entry.label)} onClick={() => { setEditing(entry.id); setAmount((entry.cents / 100).toFixed(2)); setLabel(entry.label || ''); setDate(entry.date); }}><Pencil size={12}/></IconButton><IconButton label={t('删除 ', 'Delete ') + text(entry.label)} onClick={() => { onChange?.({ entries: entries.filter(item => item !== entry) }); if (editing === entry.id) { setEditing(null); setAmount(''); setLabel(''); setDate(localDay()); setError(''); } }}><Trash2 size={12}/></IconButton></div>)}</div><p className="uw-muted">{t('金额以人民币记录，最多保留最近 200 笔。', 'Amounts are in CNY. The most recent 200 entries are kept.')}</p></div>}>
    <div className="extra-expense-total"><span className="extra-eyebrow">{t('本月支出', 'Spent this month')}</span><div className="extra-numeric"><span>¥</span><DotMatrixNumber value={metric} label={money(summary.total) + ' CNY'}/><span className="extra-expense-compact-value" role="img" aria-label={money(summary.total) + ' CNY'} title={money(summary.total) + ' CNY'}>{yuan >= 1000 ? compactCount(Math.round(yuan)) : money(summary.total)}</span></div></div>
    <div className="extra-expense-chart"><ExpenseDotChart values={summary.days} currentDay={now.getDate()} label={t('本月每日支出，合计 ', 'Daily expenses this month, total ') + money(summary.total) + ' CNY'} format={money}/></div>{quick}{quickError && <span className="extra-inline-error" role="status">{quickError}</span>}
  </WidgetShell>;
}
function TimeProgress({ config, onChange, preview, active, locale }) {
  const t = words(locale), now = useWidgetNow(active && !preview, 30000), period = ['day', 'week', 'year'].includes(config.period) ? config.period : 'year';
  const labels = { day: t('今天', 'Day'), week: t('本周', 'Week'), year: t('今年', 'Year') }, data = timeProgress(period, now);
  const remaining = data.remainingHours >= 48 ? Math.floor(data.remainingHours / 24) + t(' 天', ' days') : data.remainingHours + t(' 小时', ' hours');
  const periodTabs = <div className="extra-period-tabs" role="group" aria-label={t('时间范围', 'Time period')}>{Object.entries(labels).map(([key, label]) => <button key={key} type="button" data-board-interactive="true" disabled={preview} aria-pressed={key === period} onClick={() => onChange?.({ period: key })}>{label}</button>)}</div>;
  return <WidgetShell title={t('时间进度', 'Time progress')} icon={<Hourglass/>} preview={preview} className="extra-time"
    footer={<span className="extra-between"><span>{t('余下的时间', 'Time remaining')}</span><strong>{remaining}</strong></span>}
    details={<div className="uw-stack">{periodTabs}{Object.entries(labels).map(([key, label]) => { const progress = timeProgress(key, now); return <section className="uw-detail-section" key={key}><div className="extra-between"><strong>{label}</strong><span className="extra-time-summary-value"><DotMatrixNumber value={progress.percent.toFixed(1)}/><small>%</small></span></div><DotGrid value={progress.percent} columns={20} rows={2} label={label + ' ' + progress.percent.toFixed(1) + '%'}/></section>; })}<p className="uw-muted">{t('依据本机时区计算，周一是一周的开始。', 'Calculated in your local timezone. Each week begins on Monday.')}</p></div>}>
    {periodTabs}<div className="nv-time-instrument"><div className="nv-time-value"><DotMatrixNumber value={data.percent.toFixed(1)}/><small>%</small></div><div className="nv-time-scale"><CapsuleTrack value={data.percent} max={100} segments={12} label={labels[period] + ' ' + data.percent.toFixed(1) + '%'}/><div className="nv-scale-labels"><span>0</span><span>50</span><span>100</span></div></div><span className="nv-time-caption">{labels[period]} · {t('已经走过', 'has passed')}</span></div><div className="extra-time-compact-summary"><div><span>{data.percent.toFixed(1)}</span><small>%</small></div><span>{labels[period]}</span></div>
  </WidgetShell>;
}
const COMPONENTS = { 'world-clock': WorldClock, habits: Habits, hydration: Hydration, reading: Reading, anniversary: Anniversary, breathing: Breathing, 'quick-links': QuickLinks, 'weekly-goals': WeeklyGoals, expenses: Expenses, 'time-progress': TimeProgress };
export function ExtraWidgetContent({ kind, config = {}, onChange, preview = false, active = true, locale = 'zh-CN' }) {
  const Content = COMPONENTS[kind];
  return Content ? <Content config={config} onChange={onChange} preview={preview} active={active} locale={locale}/> : null;
}
