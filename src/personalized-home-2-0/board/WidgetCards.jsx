import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag, Newspaper, Quote, RefreshCw, Sparkles } from "../icons";
import { calendarCells, daysUntil, DRAW_RESULTS, DAILY_QUOTES, DEMO_NEWS, safeIndex } from './widget-data';
import { CodexUsageCard, WorkdayCountdownCard } from './UtilityWidgetCards';
import { normalizeCodexUsageConfig, normalizeWorkdayConfig } from './utility-widget-data';
import BoardCard from './BoardCard';
import './widget-cards.css';

const ASSETS = '/personalized-home-2-0/asset/widgets/';
const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' });
const JOKES = [
  '代码是程序员思维的镜子',
  '为什么程序员喜欢黑暗？因为光会吸引 bug。',
  '今天的代码没有报错，只是在认真思考。',
];

export const widgetCatalog = [
  { kind: 'reminder', title: '提醒', category: 'productivity', description: '记下待办和灵感，让重要的小事一眼可见。添加后可直接编辑提醒内容。', defaultConfig: { text: '' } },
  { kind: 'joke', title: '笑话', category: 'leisure', description: '给忙碌的一天留一点轻松，点击卡片就能换一条，也可以写下自己的趣味文案。', defaultConfig: { text: JOKES[0], index: 0 } },
  { kind: 'image', title: '风景', category: 'leisure', description: '把粉色树木与绿色山丘放在首页，留一小片风景，随时放松一下。', defaultConfig: { caption: '' } },
  { kind: 'weather', title: '天气', category: 'life', description: '一眼查看城市、天气与温度。当前为示意数据，可在编辑中修改。', defaultConfig: { city: '北京市', temperature: '32', condition: '多云' } },
  { kind: 'calendar', title: '日历', category: 'life', description: '把今天放在眼前，轻松翻阅每一月。', defaultConfig: { monthOffset: 0 } },
  { kind: 'countdown', title: '倒计时', category: 'life', description: '为值得期待的日子，留一个专属位置。', defaultConfig: { event: '新的开始', targetDate: `${new Date().getFullYear() + 1}-01-01` } },
  { kind: 'draw', title: '抽签', category: 'leisure', description: '抽一支灵感签，给今天一个小小的好兆头。', defaultConfig: { index: 0 } },
  { kind: 'quote', title: '每日一句', category: 'leisure', description: '用一句温柔的话，开启新的一天。', defaultConfig: { index: 0, text: '', author: '' } },
  { kind: 'news', title: '新闻', category: 'life', description: '浏览轻量资讯卡片，当前展示本地示例内容。', defaultConfig: { index: 0 } },
  { kind: 'codex-usage', title: 'Codex 用量监测', category: 'productivity', description: '用环形进度查看用量。当前为可配置示例，可设置已用比例与重置日期。', defaultConfig: normalizeCodexUsageConfig({}), createDefaultConfig: () => normalizeCodexUsageConfig({}), defaultSize: { w: 4, h: 2 } },
  { kind: 'workday-countdown', title: '下班倒计时', category: 'life', description: '美好的一天从下班开始。设置上班时间与工作时长，翻页时钟实时倒数。', defaultConfig: normalizeWorkdayConfig({}), defaultSize: { w: 4, h: 2 } },
];


function ReminderCard({ config, onChange }) {
  const sourceLines = typeof config.text === 'string' ? config.text.split('\n') : Array.isArray(config.lines) ? config.lines : [];
  const lines = sourceLines.slice(0, 2).map((line) => typeof line === 'string' ? line : String(line?.text || ''));
  const filledLines = lines.filter(line => line.trim()).length;
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const editingRef = useRef(null);

  useEffect(() => {
    if (editing !== null) inputRef.current?.focus({ preventScroll: true });
  }, [editing]);

  function beginEdit(index) {
    if (!onChange) return;
    editingRef.current = index;
    setDraft(lines[index] || '');
    setEditing(index);
  }

  function finishEdit(save) {
    const index = editingRef.current;
    if (index === null) return;
    editingRef.current = null;
    if (save && draft !== (lines[index] || '')) {
      // Preserve any extra lines entered through the board's editor.
      const next = sourceLines.map((line) => typeof line === 'string' ? line : String(line?.text || ''));
      while (next.length < 2) next.push('');
      next[index] = draft.trim();
      onChange?.({ text: next.join('\n').trimEnd() });
    }
    setEditing(null);
  }

  return <div className={`widget-content widget-reminder-content${filledLines ? ' has-reminders' : ''}`}>
    <div className="widget-reminder-heading">
      <img className="widget-reminder-icon" src={`${ASSETS}reminder.png`} alt="" draggable="false" />
      {filledLines
        ? <div className="widget-reminder-meta"><span>待办清单</span><small><b>{filledLines}</b> 条提醒</small></div>
        : <div className="widget-reminder-summary" aria-hidden="true"><span /><span /></div>}
    </div>
    <div className="widget-reminder-lines">
      {[0, 1].map((index) => editing === index
        ? <input
            className="widget-reminder-input"
            key={index}
            ref={inputRef}
            value={draft}
            aria-label={`第 ${index + 1} 条提醒`}
            maxLength={Math.max((lines[index] || '').length, 2000 - sourceLines.filter((_, lineIndex) => lineIndex !== index).join('\n').length - Math.max(1, sourceLines.length - 1))}
            data-board-interactive="true"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => finishEdit(true)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') { event.preventDefault(); finishEdit(true); }
              if (event.key === 'Escape') { event.preventDefault(); finishEdit(false); }
            }}
          />
        : <button
            className={`widget-reminder-line${lines[index] ? ' has-content' : ''}`}
            key={index}
            type="button"
            data-board-interactive="true"
            disabled={!onChange}
            aria-label={lines[index] ? `编辑提醒：${lines[index]}` : `添加第 ${index + 1} 条提醒`}
            onClick={() => beginEdit(index)}
          >{lines[index] || <span aria-hidden="true" />}</button>)}
    </div>
  </div>;
}

function JokeCard({ config, onChange }) {
  const text = typeof config.text === 'string' && config.text ? config.text : JOKES[0];
  const displayText = text === JOKES[0] ? '代码是程序员\n思维的镜子' : text;
  function nextJoke() {
    const currentIndex = JOKES.indexOf(text);
    const nextIndex = (currentIndex + 1) % JOKES.length;
    onChange?.({ text: JOKES[nextIndex], index: nextIndex });
  }
  return <button
    className="widget-joke-button"
    type="button"
    disabled={!onChange}
    data-board-interactive="true"
    aria-label={`笑话：${text}。点击换一条`}
    onClick={nextJoke}
  >
    <img className="widget-joke-icon" src={`${ASSETS}laughing.svg`} alt="" draggable="false" />
    <span className="widget-joke-copy" aria-hidden="true">{displayText}</span>
  </button>;
}

function WeatherCard({ config }) {
  const city = String(config.city || '北京市');
  const temperature = String(config.temperature ?? config.temp ?? '32').replace(/°[Cc]?$/, '');
  const condition = String(config.condition || '多云');
  return <div className="widget-content widget-weather-content">
    <div className="widget-weather-top">
      <img className="widget-weather-icon" src={`${ASSETS}weather.svg`} alt={condition} draggable="false" />
      <div className="widget-weather-place"><span className="widget-weather-city" title={city}>{city}</span><span className="widget-weather-condition" title={condition}>{condition}</span></div>
    </div>
    <span className="widget-weather-temperature" aria-label={`${temperature} 度`}><span>{temperature}</span><sup>°</sup></span>
    <span className="widget-sr-only">{condition}，天气演示数据</span>
  </div>;
}

function useToday(active) {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const next = new Date();
      setToday(previous => previous.getFullYear() === next.getFullYear() && previous.getMonth() === next.getMonth() && previous.getDate() === next.getDate() ? previous : next);
    };
    let timer;
    const sync = () => {
      window.clearInterval(timer);
      if (document.hidden) return;
      update();
      timer = window.setInterval(update, 60_000);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sync); };
  }, [active]);
  return today;
}

function CalendarCard({ config, onChange, active }) {
  const today = useToday(active);
  const offset = Math.max(-1200, Math.min(1200, Number(config.monthOffset) || 0));
  const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = date.getFullYear();
  const month = date.getMonth();
  const sameMonth = year === today.getFullYear() && month === today.getMonth();
  const weekday = weekdayFormatter.format(today);
  const cells = calendarCells(year, month);
  const weeks = cells.slice(35).some(Boolean) ? 6 : 5;
  return <div className="widget-content widget-calendar-content">
    <div className="widget-calendar-heading">
      <span><small>{year} 年 </small><b><span className="widget-calendar-month-number">{month + 1}</span> 月</b></span>
      <div className="widget-calendar-nav">
        <button type="button" data-board-interactive="true" disabled={!onChange || offset <= -1200} aria-label="上个月" onClick={() => onChange?.({ monthOffset: offset - 1 })}><ChevronLeft /></button>
        <button type="button" data-board-interactive="true" disabled={!onChange || offset >= 1200} aria-label="下个月" onClick={() => onChange?.({ monthOffset: offset + 1 })}><ChevronRight /></button>
      </div>
    </div>
    <div className="widget-calendar-summary"><span>{month + 1} 月</span><strong>{sameMonth ? today.getDate() : 1}</strong><span>{sameMonth ? weekday : `${year} 年`}</span></div>
    <div className="widget-calendar-grid" style={{ '--calendar-rows': weeks + 1 }} aria-label={`${year} 年 ${month + 1} 月日历`}>
      {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span className="widget-calendar-weekday" key={day}>{day}</span>)}
      {cells.slice(0, weeks * 7).map((day, index) => <span key={index} className={`${sameMonth && day === today.getDate() ? 'is-today' : ''} ${index % 7 > 4 ? 'is-weekend' : ''}`} aria-current={sameMonth && day === today.getDate() ? 'date' : undefined}>{day}</span>)}
    </div>
    <button className="widget-calendar-today" type="button" data-board-interactive="true" disabled={!onChange || offset === 0} onClick={() => onChange?.({ monthOffset: 0 })}>{offset === 0 ? '每一天，都值得期待' : '回到今天'}</button>
  </div>;
}

function CountdownCard({ config, active }) {
  const today = useToday(active);
  const days = daysUntil(config.targetDate, today);
  return <div className="widget-content widget-countdown-content">
    <div className="widget-card-eyebrow"><Flag size={14} /><span>{days === null ? '设置日期' : days < 0 ? '已经过去' : days === 0 ? '就是今天' : '还有'}</span></div>
    <div className="widget-countdown-value"><strong style={{ '--countdown-digits': String(Math.abs(days ?? 0)).length }}>{days === null ? '—' : Math.abs(days)}</strong><span><small className="widget-countdown-compact-status">{days === null ? '待设置' : days < 0 ? '已过' : days === 0 ? '今天' : '还有'}</small>天</span></div>
    <div className="widget-countdown-copy"><b title={config.event}>{config.event || '值得期待的日子'}</b><span>{config.targetDate || '编辑后开始计时'}</span></div>
  </div>;
}

function DrawCard({ config, onChange }) {
  const index = safeIndex(config.index, DRAW_RESULTS.length);
  const result = DRAW_RESULTS[index];
  const [drawing, setDrawing] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  function draw() {
    if (!onChange || drawing) return;
    setDrawing(true);
    const next = (index + 1 + Math.floor(Math.random() * (DRAW_RESULTS.length - 1))) % DRAW_RESULTS.length;
    onChange({ index: next });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDrawing(false), 320);
  }
  return <button className={`widget-content widget-draw-content${drawing ? ' is-drawing' : ''}`} data-tone={result.color} type="button" data-board-interactive="true" disabled={!onChange} aria-label={`灵感签：${result.title}。${result.note}。点击再抽一签`} onClick={draw}>
    <div className="widget-card-eyebrow"><Sparkles size={14} /><span>今日灵感</span></div>
    <span className="widget-draw-result" key={index}>{result.title}</span>
    <span className="widget-draw-note">{result.note}</span>
    <span className="widget-card-action"><RefreshCw size={11} />再抽一签</span>
  </button>;
}

function QuoteCard({ config, onChange }) {
  const index = safeIndex(config.index, DAILY_QUOTES.length);
  const current = typeof config.text === 'string' && config.text.trim() ? { text: config.text, author: config.author || '我的寄语' } : DAILY_QUOTES[index];
  return <button className="widget-content widget-quote-content" type="button" data-board-interactive="true" disabled={!onChange} aria-label={`${current.text}。点击换一句`} onClick={() => onChange?.({ index: (index + 1) % DAILY_QUOTES.length, text: '', author: '' })}>
    <Quote className="widget-quote-mark" size={26} />
    <span className="widget-quote-text">{current.text}</span>
    <span className="widget-quote-author">— {current.author}</span>
  </button>;
}

function NewsCard({ config, onChange }) {
  const index = safeIndex(config.index, DEMO_NEWS.length);
  return <div className="widget-content widget-news-content">
    <div className="widget-news-heading"><span><Newspaper size={14} /><b>新闻</b><small>示例</small></span><button type="button" data-board-interactive="true" disabled={!onChange} aria-label="换一组示例新闻" onClick={() => onChange?.({ index: (index + 1) % DEMO_NEWS.length })}><RefreshCw size={12} /></button></div>
    <ol className="widget-news-list">{DEMO_NEWS[index].map((news, itemIndex) => <li key={news.title}><span className="widget-news-number">{String(itemIndex + 1).padStart(2, '0')}</span><div><span className="widget-news-category">{news.category}</span><span className="widget-news-title" title={news.title}>{news.title}</span></div></li>)}</ol>
    <span className="widget-news-footer">本地示例 · 非实时资讯</span>
  </div>;
}

/** Card content only: the board owns placement, resizing, selection, and editing controls. */
export function WidgetCard({ kind, item = {}, size, onChange, inert = false, preview = false, active = true }) {
  const resolvedKind = kind || item.kind || 'reminder';
  const definition = widgetCatalog.find((entry) => entry.kind === resolvedKind) || widgetCatalog[0];
  const config = { ...definition.defaultConfig, ...(item.config || {}) };
  const actualKind = definition.kind;
  if (actualKind === 'reminder' && item.config?.text === undefined && Array.isArray(item.config?.lines)) {
    config.text = item.config.lines.map((line) => typeof line === 'string' ? line : String(line?.text || '')).join('\n');
  }
  if (actualKind === 'weather' && item.config?.temperature === undefined && item.config?.temp !== undefined) {
    config.temperature = item.config.temp;
  }
  return <BoardCard
    className={`board-widget-card widget-${actualKind}`}
    inert={inert}
    data-widget-kind={actualKind}
    data-widget-width={size?.w}
    data-widget-height={size?.h}
    aria-label={item.title || definition.title}
  >
    {actualKind === 'reminder' && <ReminderCard config={config} onChange={onChange} />}
    {actualKind === 'joke' && <JokeCard config={config} onChange={onChange} />}
    {actualKind === 'image' && <>
      <img className="widget-landscape" src={`${ASSETS}landscape.png`} alt={config.caption || '粉色树木点缀绿色山丘'} draggable="false" />
      {config.caption && <span className="widget-image-caption" aria-hidden="true">{config.caption}</span>}
    </>}
    {actualKind === 'weather' && <WeatherCard config={config} />}
    {actualKind === 'calendar' && <CalendarCard config={config} onChange={onChange} active={active && !preview} />}
    {actualKind === 'countdown' && <CountdownCard config={config} active={active && !preview} />}
    {actualKind === 'draw' && <DrawCard config={config} onChange={onChange} />}
    {actualKind === 'quote' && <QuoteCard config={config} onChange={onChange} />}
    {actualKind === 'news' && <NewsCard config={config} onChange={onChange} />}
    {actualKind === 'codex-usage' && <CodexUsageCard config={config} onChange={onChange} preview={preview} />}
    {actualKind === 'workday-countdown' && <WorkdayCountdownCard config={config} onChange={onChange} preview={preview} active={active} />}
  </BoardCard>;
}

export default WidgetCard;
