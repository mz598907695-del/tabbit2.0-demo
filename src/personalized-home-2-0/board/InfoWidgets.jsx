import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RefreshCw, Sun, Moon, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Snowflake, Wind, Droplets, ExternalLink } from 'lucide-react';
import { WidgetShell, WidgetButton, Field, Metric, DotMatrixNumber, TickRing, DotGrid, DotProgress, Sparkline, useWidgetNow } from './UnifiedWidgetKit';
import { INFO_CACHE_TTL, infoText, infoString, infoLocale, clampNumber, readInfoCache, fetchInfoResource, loadInfoNews, loadInfoWeather, searchInfoCities, weatherDescription, monthCells, clockParts, dailyInfoQuote, usageReading } from './info-widget-data';
import './info-widgets.css';

// Match the shared dot glyph's advance so units sit beside the actual number.
const infoNumberAspect = value => Math.max(1, [...String(value)].reduce((width, char) => width + (char === '-' ? 34.4 : 50.4), 0) - 8) / 55;
const Input = props => <input className="uw-input" data-board-interactive="true" {...props}/>;
const timeLabel = (value, locale) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateLabel = (value, locale) => Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
function MiniButton({ label, children, ...props }) { return <button type="button" data-board-interactive="true" className="iw-mini-button" aria-label={label} title={label} {...props}>{children}</button>; }
function useInfoRemote(key, load, enabled, ttl) {
  const [state, setState] = useState(() => ({ key, ...readInfoCache(key), loading: false, error: '' }));
  const [revision, setRevision] = useState(0);
  const lastForced = useRef(0);
  useEffect(() => {
    let disposed = false;
    const cached = readInfoCache(key);
    setState({ key, ...cached, loading: false, error: '' });
    if (!enabled) return;
    const run = async force => {
      const current = readInfoCache(key);
      if (!force && current && Date.now() - current.at < ttl) return;
      setState(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const next = await fetchInfoResource(key, load);
        if (!disposed) setState({ key, ...next, loading: false, error: '' });
      } catch (error) {
        if (!disposed) setState(previous => ({ ...previous, loading: false, error: error?.message === 'rate-limit' ? 'rate-limit' : 'network' }));
      }
    };
    run(revision > 0);
    const timer = setInterval(() => { if (!document.hidden) run(false); }, ttl);
    return () => { disposed = true; clearInterval(timer); };
  }, [key, enabled, revision, ttl]);
  const visible = state.key === key ? state : { key, ...readInfoCache(key), loading: enabled, error: '' };
  return { ...visible, refresh: () => { if (!enabled || visible.loading || Date.now() - lastForced.current < 5000) return; lastForced.current = Date.now(); setRevision(value => value + 1); } };
}
function RemoteStatus({ state, locale, source, preview }) {
  const t = (zh, en) => infoText(locale, zh, en);
  const text = preview && !state.data ? t('添加后联网更新', 'Updates after adding') : state.error ? state.data ? t('更新失败 · 显示缓存', 'Offline · cached data') : state.error === 'rate-limit' ? t('请求频繁，请稍后刷新', 'Rate limited. Try again soon.') : t('连接失败，点击刷新重试', 'Connection failed. Tap refresh.') : state.loading ? t('正在更新…', 'Updating…') : state.at ? `${timeLabel(state.at, locale)} ${t('更新', 'updated')}` : t('等待更新', 'Waiting for data');
  return <span className={`iw-remote-status${state.error ? ' is-error' : ''}`} role={state.error ? 'status' : undefined}><i aria-hidden="true"/>{source && <span className="iw-source">{source} · </span>}{text}</span>;
}

function ClockWidget({ config, onChange, preview, active, locale }) {
  const now = useWidgetNow(active && !preview), t = (zh, en) => infoText(locale, zh, en);
  const parts = clockParts(now, infoString(config.timeZone), locale), seconds = Number(parts.seconds);
  const title = infoString(config.city).trim() || t('时钟', 'Clock');
  const zones = [['', t('系统时区', 'System time zone')], ['Asia/Shanghai', t('北京 / 上海', 'Beijing / Shanghai')], ['Asia/Tokyo', t('东京', 'Tokyo')], ['Europe/London', t('伦敦', 'London')], ['Europe/Paris', t('巴黎', 'Paris')], ['America/New_York', t('纽约', 'New York')], ['America/Los_Angeles', t('洛杉矶', 'Los Angeles')], ['Australia/Sydney', t('悉尼', 'Sydney')], ['UTC', 'UTC']];
  const display = config.seconds ? `${parts.time}:${parts.seconds}` : parts.time;
  const zoneLabel = new Intl.DateTimeFormat(locale, { ...(parts.timeZone ? { timeZone: parts.timeZone } : {}), timeZoneName: 'short' }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '';
  return <WidgetShell title={title} preview={preview} className="iw-widget iw-clock" footer={<div className="iw-clock-footer"><span>{parts.date}</span><span className="iw-zone-pill">{zoneLabel}</span></div>} details={<div className="iw-detail uw-stack"><section className="uw-detail-summary iw-clock-summary"><div className="iw-detail-clock"><DotMatrixNumber value={display} label={display}/></div><p className="iw-muted">{parts.date} · {parts.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone}</p></section><section className="uw-detail-section"><h3>{t('显示设置', 'Display settings')}</h3><Field label={t('时区', 'Time zone')}><select value={parts.timeZone} onChange={e => onChange?.({ timeZone: e.target.value })}>{zones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label={t('显示秒数', 'Show seconds')}><select value={config.seconds ? 'yes' : 'no'} onChange={e => onChange?.({ seconds: e.target.value === 'yes' })}><option value="no">{t('时与分', 'Hours and minutes')}</option><option value="yes">{t('时、分与秒', 'Hours, minutes and seconds')}</option></select></Field><Field label={t('卡片名称', 'Card title')}><Input maxLength={30} placeholder={t('时钟', 'Clock')} value={infoString(config.city)} onChange={e => onChange?.({ city: e.target.value })}/></Field></section></div>}>
    <div className="iw-clock-face"><TickRing value={seconds} max={60} ticks={60} label={t(`当前 ${seconds} 秒`, `${seconds} seconds`)}><div className="iw-clock-center"><DotMatrixNumber value={parts.time} label={parts.time}/><span className="iw-clock-seconds"><DotMatrixNumber value={parts.seconds}/><small>{t('秒', 'sec')}</small></span><span className={`iw-clock-note${config.seconds ? '' : ' is-context'}`}>{config.seconds ? `${parts.seconds} ${t('秒', 'sec')}` : t('此时此刻', 'RIGHT NOW')}</span></div></TickRing></div>
    <div className="iw-clock-inline"><DotMatrixNumber value={display} label={display}/><span className="iw-muted">{parts.date}</span></div><time className="iw-clock-strip" aria-label={display}>{parts.time}</time><time className="iw-clock-narrow" aria-label={display} title={display}><span aria-hidden="true">{parts.time.split(':')[0]}</span><span aria-hidden="true">{parts.time.split(':')[1]}</span></time>
  </WidgetShell>;
}

function CalendarWidget({ config, onChange, preview, active, locale }) {
  const now = useWidgetNow(active && !preview, 60_000), t = (zh, en) => infoText(locale, zh, en), offset = Math.trunc(clampNumber(config.monthOffset, -1200, 1200));
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1), cells = monthCells(month.getFullYear(), month.getMonth());
  const heading = month.toLocaleDateString(locale, { year: 'numeric', month: 'long' }), monthName = month.toLocaleDateString(locale, { month: 'long' }), yearName = month.toLocaleDateString(locale, { year: 'numeric' }), weekdays = locale === 'en-US' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : [...'一二三四五六日'];
  const shift = delta => onChange?.({ monthOffset: Math.max(-1200, Math.min(1200, offset + delta)) });
  const grid = detail => <div className={`iw-calendar-grid${detail ? ' is-detail' : ''}`} aria-label={heading}>{weekdays.map((day, i) => <span key={`w${i}`} className={`iw-weekday${i > 4 ? ' is-weekend' : ''}`}>{day}</span>)}{cells.map((day, i) => <span key={i} className={`iw-day${i % 7 > 4 ? ' is-weekend' : ''}${offset === 0 && day === now.getDate() ? ' is-today' : ''}`} aria-current={offset === 0 && day === now.getDate() ? 'date' : undefined}>{day}</span>)}</div>;
  const navigation = <div className="iw-calendar-nav"><MiniButton label={t('上个月', 'Previous month')} disabled={preview || offset <= -1200} onClick={() => shift(-1)}><ArrowLeft/></MiniButton><button type="button" data-board-interactive="true" className="iw-month-label" title={t('回到本月', 'Back to this month')} disabled={preview} onClick={() => onChange?.({ monthOffset: 0 })} aria-label={heading}><span className="iw-month-year">{yearName}</span><span className="iw-month-name">{monthName}</span><span className="iw-month-short">{month.toLocaleDateString(locale, { year: 'numeric', month: 'short' })}</span></button><MiniButton label={t('下个月', 'Next month')} disabled={preview || offset >= 1200} onClick={() => shift(1)}><ArrowRight/></MiniButton></div>;
  return <WidgetShell title={t('日历', 'Calendar')} preview={preview} className="iw-widget iw-calendar" details={<div className="iw-detail uw-stack">{navigation}{grid(true)}<WidgetButton onClick={() => onChange?.({ monthOffset: 0 })}>{t('回到本月', 'Back to this month')}</WidgetButton><p className="iw-muted">{now.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></div>}>
    {navigation}{grid(false)}<div className="iw-calendar-tiny"><span className="iw-calendar-tiny-month">{now.toLocaleDateString(locale, { month: 'short' })}</span><span className="iw-calendar-tiny-day"><DotMatrixNumber value={now.getDate()}/></span><span className="iw-calendar-tiny-meta">{now.toLocaleDateString(locale, { month: 'short', weekday: 'short' })}</span></div><div className="iw-calendar-strip"><span>{now.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}</span><span>{now.toLocaleDateString(locale, { weekday: 'short' })}</span></div>
  </WidgetShell>;
}

function QuoteWidget({ config, onChange, preview, active, locale }) {
  const now = useWidgetNow(active && !preview, 60_000), quote = dailyInfoQuote(config, locale, now), t = (zh, en) => infoText(locale, zh, en);
  const hasAttribution = !['', '今日寄语', 'A daily thought'].includes(infoString(config.author).trim());
  const next = () => onChange?.({ index: (Number(config.index) || 0) + 1, text: '', author: '' });
  const details = <div className="iw-detail uw-stack">
    <section className="uw-detail-summary iw-quote-summary">
      <blockquote className="iw-detail-quote">{quote.text}</blockquote>
      <div className="iw-footer-row"><span className="iw-muted">{quote.author}</span><WidgetButton onClick={next}><RefreshCw size={14}/>{t('换一句', 'Next thought')}</WidgetButton></div>
    </section>
    <section className="uw-detail-section">
      <h3>{t('写给自己', 'A note to yourself')}</h3>
      <Field label={t('自定义句子', 'Your own thought')}><textarea rows={4} maxLength={500} placeholder={t('留空时，每天为你换一句寄语', 'Leave blank for a new thought each day')} value={infoString(config.text)} onChange={e => onChange?.({ text: e.target.value })}/></Field>
      <Field label={t('署名', 'Attribution')}><Input maxLength={60} value={infoString(config.author)} onChange={e => onChange?.({ author: e.target.value })}/></Field>
      <p className="uw-detail-caption">{t('默认寄语每天更换，也可手动切换。', 'A new thought each day. Or choose the next one yourself.')}</p>
    </section>
  </div>;
  return <WidgetShell title={t('每日一句', 'Daily thought')} preview={preview} className={`iw-widget iw-quote${hasAttribution ? '' : ' has-default-author'}`} details={details} actions={<MiniButton label={t('换一句', 'Next thought')} disabled={preview} onClick={next}><RefreshCw/></MiniButton>} footer={hasAttribution ? <span className="iw-quote-author">{quote.author}</span> : null}>
    <blockquote className="iw-quote-text">{quote.text}</blockquote>
  </WidgetShell>;
}

function UsageWidget({ config, onChange, preview, locale }) {
  const t = (zh, en) => infoText(locale, zh, en), reading = usageReading(config), provider = infoString(config.provider).trim() || 'AI', [detailsOpen, setDetailsOpen] = useState(false);
  const save = value => onChange?.({ usedPercent: value, updatedAt: new Date().toISOString() });
  return <WidgetShell title={t('AI 余量', 'AI allowance')} preview={preview} className="iw-widget iw-usage" detailOpen={detailsOpen} onDetailOpenChange={setDetailsOpen} footer={<div className="iw-footer-row"><span>{t('手动记录', 'Manual record')}</span><button type="button" className="iw-text-button" data-board-interactive="true" disabled={preview} onClick={() => reading.hasValue ? save(Math.min(100, reading.used + 5)) : setDetailsOpen(true)}>{reading.hasValue ? t('+5% 已用', '+5% used') : t('开始记录', 'Start')}</button></div>} details={<div className="iw-detail uw-stack"><section className="uw-detail-summary iw-usage-detail-hero"><Metric value={reading.hasValue ? Number(reading.remaining.toFixed(1)) : '—'} unit={t('% 剩余', '% left')}/><DotGrid value={reading.hasValue ? reading.remaining : 0} max={100} columns={20} rows={5} label={t('剩余额度', 'Remaining allowance')}/></section><section className="uw-detail-section"><h3>{t('用量记录', 'Your allowance record')}</h3><Field label={t('AI 产品', 'AI product')}><Input maxLength={40} value={provider} onChange={e => onChange?.({ provider: e.target.value })}/></Field><Field label={t('已用比例（%）', 'Used allowance (%)')}><Input type="number" min="0" max="100" step="1" value={reading.hasValue ? reading.used : ''} onChange={e => save(e.target.value === '' ? null : clampNumber(e.target.value, 0, 100))}/></Field><Field label={t('重置日期', 'Reset date')}><Input type="date" value={infoString(config.resetDate)} onChange={e => onChange?.({ resetDate: e.target.value })}/></Field><div className="uw-row"><WidgetButton onClick={() => save(0)}>{t('记录为全部可用', 'Mark fully available')}</WidgetButton><WidgetButton onClick={() => save(null)}>{t('清除记录', 'Clear record')}</WidgetButton></div></section><p className="uw-detail-caption">{t('由你手动记录，不读取 AI 服务账号，也不会自动推测用量。', 'Manually recorded by you. This does not read an AI account or estimate its usage.')}{config.updatedAt && ` ${t('上次记录', 'Last recorded')}: ${dateLabel(config.updatedAt, locale)}`}</p></div>}>
    <div className="iw-usage-heading"><span className="iw-muted">{provider}</span><span className="iw-usage-label">{t('剩余', 'REMAINING')}</span></div><div className="iw-usage-value" style={{ '--iw-number-ratio': infoNumberAspect(reading.hasValue ? Math.round(reading.remaining) : '—') }}><DotMatrixNumber value={reading.hasValue ? String(Math.round(reading.remaining)) : '—'} label={reading.hasValue ? `${reading.remaining}%` : t('尚未记录', 'Not recorded')}/><span>%</span></div><div className={`iw-usage-grid${reading.hasValue ? '' : ' is-empty'}`}><DotGrid value={reading.hasValue ? reading.remaining : 0} max={100} columns={20} rows={5} label={t('剩余额度', 'Remaining allowance')}/></div><div className={`iw-usage-line${reading.hasValue ? '' : ' is-empty'}`}><DotProgress value={reading.hasValue ? reading.remaining : 0}/></div><span className="iw-usage-reset iw-muted">{config.resetDate ? `${t('重置', 'Resets')} · ${config.resetDate}` : reading.hasValue ? t('每个点代表 1%', 'Each dot represents 1%') : t('记录后显示剩余额度', 'Record your allowance to begin')}</span>
  </WidgetShell>;
}

function WeatherSymbol({ code, isDay = true }) {
  const fog = [45, 48].includes(code), thunder = code >= 95, snow = [71, 73, 75, 77, 85, 86].includes(code);
  const scene = code === 0 ? isDay ? 'sun' : 'night' : code <= 3 || fog || snow ? 'cloud' : 'rain';
  const Icon = code === 0 ? isDay ? Sun : Moon : fog ? CloudFog : thunder ? CloudLightning : snow ? CloudSnow : code <= 3 ? Cloud : CloudRain;
  const [failedSource, setFailedSource] = useState('');
  const src = `/personalized-home-2-0/asset/widgets/editorial/weather-${scene}.webp`;
  const failed = failedSource === src;
  return <span className={`iw-weather-symbol is-${scene}${fog ? ' has-fog' : ''}${thunder ? ' has-thunder' : ''}${snow ? ' has-snow' : ''}`} aria-hidden="true">
    {failed ? <Icon className="iw-weather-fallback" strokeWidth={1.15}/> : <img src={src} alt="" draggable="false" decoding="async" onError={() => setFailedSource(src)}/>}
    {!failed && thunder && <CloudLightning className="iw-weather-state" strokeWidth={1.5}/>}
    {!failed && snow && <Snowflake className="iw-weather-state" strokeWidth={1.5}/>}
    {!failed && fog && <span className="iw-weather-mist"><i/><i/><i/></span>}
  </span>;
}
function WeatherWidget({ config, onChange, preview, active, locale }) {
  const t = (zh, en) => infoText(locale, zh, en), latitude = clampNumber(config.latitude, -90, 90, 39.9042), longitude = clampNumber(config.longitude, -180, 180, 116.4074), city = infoString(config.city) || t('北京', 'Beijing');
  const state = useInfoRemote(`weather:${latitude}:${longitude}`, () => loadInfoWeather(latitude, longitude), active && !preview, INFO_CACHE_TTL.weather);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const current = state.data?.current, hours = state.data?.hourly || [], [query, setQuery] = useState(city), [cities, setCities] = useState([]), [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const searchController = useRef(null);
  useEffect(() => () => searchController.current?.abort(), []);
  const search = async () => {
    if (query.trim().length < 2 || preview) return;
    searchController.current?.abort(); const controller = new AbortController(); searchController.current = controller; setSearching(true); setSearchError('');
    try { const result = await searchInfoCities(query, locale, controller.signal); if (searchController.current !== controller) return; setCities(result); if (!result.length) setSearchError(t('未找到城市，试试英文名或加上国家。', 'No matching city. Try its English name or add a country.')); }
    catch { if (searchController.current === controller) setSearchError(t('城市搜索失败，请重试。', 'City search failed. Please try again.')); }
    finally { if (searchController.current === controller) { setSearching(false); searchController.current = null; } }
  };
  const refresh = <MiniButton label={t('刷新天气', 'Refresh weather')} disabled={preview || state.loading} onClick={state.refresh}><RefreshCw className={state.loading ? 'iw-refreshing' : ''}/></MiniButton>;
  const forecast = detail => hours.length > 1 && <div className={`iw-weather-forecast${detail ? ' is-detail' : ''}`}><div className="iw-footer-row"><span className="iw-forecast-period">{t('未来 12 小时', 'Next 12 hours')}</span><span className="iw-forecast-period-short">{t('12 小时', '12h')}</span><span>{Math.round(Math.min(...hours.map(h => h.value)))}° — {Math.round(Math.max(...hours.map(h => h.value)))}°</span></div><Sparkline values={hours.map(hour => hour.value)} label={t('未来 12 小时温度预报', 'Temperature forecast for the next 12 hours')}/><div className="iw-footer-row iw-forecast-times"><span>{hours[0].time.slice(11, 16)}</span><span>{hours.at(-1).time.slice(11, 16)}</span></div></div>;
  const details = <div className="iw-detail uw-stack">
    <section className="uw-detail-summary iw-weather-summary">
      <div className="iw-weather-detail-hero"><div><span className="iw-weather-detail-city">{city}</span><Metric value={current ? Math.round(current.temperature_2m) : '—'} unit="°C"/><span className="iw-muted">{current ? weatherDescription(current.weather_code, locale) : t('尚无天气数据', 'No weather data yet')}</span></div>{current && <WeatherSymbol code={current.weather_code} isDay={current.is_day !== 0}/>}</div>
      {current && <div className="iw-weather-facts"><span><Droplets/>{t('湿度', 'Humidity')} <b>{current.relative_humidity_2m}%</b></span><span><Wind/>{t('风速', 'Wind')} <b>{current.wind_speed_10m} km/h</b></span></div>}
      {forecast(true)}
      <div className="iw-footer-row"><RemoteStatus state={state} locale={locale}/><WidgetButton disabled={state.loading} onClick={state.refresh}><RefreshCw size={14} className={state.loading ? 'iw-refreshing' : ''}/>{state.loading ? t('正在更新…', 'Updating…') : t('刷新天气', 'Refresh weather')}</WidgetButton></div>
    </section>
    <section className="uw-detail-section">
      <h3>{t('关注的城市', 'Your city')}</h3>
      <Field label={t('更换城市', 'Change city')}><div className="iw-city-search"><Input value={query} maxLength={80} placeholder={t('输入城市名', 'Enter a city name')} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }}/><WidgetButton disabled={searching || query.trim().length < 2} onClick={search}>{searching ? t('搜索中…', 'Searching…') : t('搜索', 'Search')}</WidgetButton></div></Field>
      {searchError && <span role="status" className="iw-muted">{searchError}</span>}
      {!!cities.length && <div className="iw-city-results">{cities.map(result => <WidgetButton key={result.id} onClick={() => { onChange?.({ city: result.name, latitude: result.latitude, longitude: result.longitude }); setQuery(result.name); setCities([]); }}>{result.name}<span>{[result.admin1, result.country].filter(Boolean).join(' · ')}</span></WidgetButton>)}</div>}
    </section>
    <p className="uw-detail-caption">{t('天气与预报来自', 'Weather and forecasts by')} <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · {t('城市数据', 'City data')}: GeoNames{current?.time && <><br/>{t('天气时间', 'Weather time')}: {current.time.replace('T', ' ')} · {state.data.timezone}</>}</p>
  </div>;
  return <WidgetShell title={t('天气', 'Weather')} preview={preview} className="iw-widget iw-weather" detailOpen={detailsOpen} onDetailOpenChange={setDetailsOpen} actions={refresh} footer={<RemoteStatus state={state} locale={locale} preview={preview}/>} details={details}>
    <button type="button" data-board-interactive="true" className="iw-weather-city" disabled={preview} title={t('更换城市', 'Change city')} onClick={() => setDetailsOpen(true)}>{city}</button><div className="iw-weather-current"><div className="iw-weather-value" style={{ '--iw-number-ratio': infoNumberAspect(current ? Math.round(current.temperature_2m) : '—') }}><DotMatrixNumber value={current ? String(Math.round(current.temperature_2m)) : '—'} label={current ? `${Math.round(current.temperature_2m)}°C` : t('暂无温度', 'No temperature')}/><span>°</span></div>{current ? <WeatherSymbol code={current.weather_code} isDay={current.is_day !== 0}/> : <Cloud className="iw-weather-symbol is-pending" strokeWidth={1.15} aria-hidden="true"/>}</div><span className="iw-weather-condition">{current ? weatherDescription(current.weather_code, locale) : preview ? t('添加后获取实时天气', 'Live weather after adding') : state.loading ? t('正在获取天气…', 'Fetching weather…') : state.error ? t('连接失败', 'Unavailable') : t('等待天气数据', 'Waiting for weather')}</span>{forecast(false)}
  </WidgetShell>;
}


function NewsHeadlineList({ stories, preview, locale }) {
  const listRef = useRef(null);
  const [layout, setLayout] = useState({ count: 1, rowHeight: 28, lines: 1 });
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      // Use layout pixels so scaled catalogue previews keep the same row count.
      const height = list.clientHeight;
      const style = getComputedStyle(list);
      const preferred = Number.parseFloat(style.getPropertyValue('--iw-headline-row-height')) || 28;
      const limit = Math.max(1, Math.min(20, Number.parseInt(style.getPropertyValue('--iw-headline-max-count'), 10) || 20));
      // These values also size the text and padding in CSS, including narrow cards.
      const lineHeight = Number.parseFloat(style.getPropertyValue('--iw-headline-line-height')) || 20;
      const rowPadding = Number.parseFloat(style.getPropertyValue('--iw-headline-row-padding')) || 0;
      const lineLimit = Number.parseInt(style.getPropertyValue('--iw-headline-line-limit'), 10) || 1;
      const count = height >= lineHeight + rowPadding ? Math.min(limit, Math.max(1, Math.floor((height + 0.25) / preferred))) : 0;
      const rowHeight = limit === 1 ? height : Math.min(preferred, Math.max(0, height));
      const lines = Math.max(1, Math.min(lineLimit, Math.floor((rowHeight - rowPadding) / lineHeight)));
      setLayout(previous => previous.count === count && previous.lines === lines && Math.abs(previous.rowHeight - rowHeight) < 0.25 ? previous : { count, rowHeight, lines });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  return <ol ref={listRef} className="iw-news-headlines" aria-label={infoText(locale, '新闻标题', 'News headlines')} style={{ '--iw-headline-row-size': `${layout.rowHeight}px`, '--iw-headline-visible-lines': layout.lines }}>
    {stories.slice(0, layout.count).map((story, index) => <li key={story.url}>
      <span className="iw-headline-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <a href={story.url} target="_blank" rel="noopener noreferrer" data-board-interactive="true" title={[story.title, story.source].filter(Boolean).join(' · ')} tabIndex={preview ? -1 : undefined}>{story.title}</a>
    </li>)}
  </ol>;
}

function NewsWidget({ config, onChange, preview, active, locale }) {
  const t = (zh, en) => infoText(locale, zh, en), language = config.newsLanguage === 'en' ? 'en' : config.newsLanguage === 'zh' ? 'zh' : locale === 'en-US' ? 'en' : 'zh', category = ['general', 'technology', 'world'].includes(config.category) ? config.category : 'general';
  const source = config.newsSource === 'gdelt' ? 'gdelt' : language === 'en' ? 'ecns' : 'chinanews', sourceName = source === 'chinanews' ? t('中新网', 'China News Service') : source === 'ecns' ? 'ECNS' : 'GDELT';
  const state = useInfoRemote(`news:${source}:${language}:${category}`, () => loadInfoNews(language, category, source), active && !preview, INFO_CACHE_TTL.news), stories = Array.isArray(state.data) ? state.data : [];
  const refresh = <MiniButton label={t('刷新新闻', 'Refresh news')} disabled={preview || state.loading} onClick={state.refresh}><RefreshCw className={state.loading ? 'iw-refreshing' : ''}/></MiniButton>;
  const sourceNotes = <p className="uw-detail-caption">{source !== 'gdelt' ? <>{t('来自', 'From')} <a href={source === 'ecns' ? 'https://www.ecns.cn/' : 'https://www.chinanews.com.cn/'} target="_blank" rel="noopener noreferrer">{sourceName}</a> {t('官方即时新闻 RSS，点击标题阅读原文。', 'official live-news RSS. Open a headline to read the original report.')}</> : <>{t('过去 24 小时的报道，由', 'Reports from the last 24 hours, indexed by')} <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">GDELT</a> {t('汇集，按采集时间排序。标题保留原文，点击前往新闻源。', '. Ordered by index time. Original-language headlines link to the publisher.')}</>}{state.at && ` ${t('本地更新时间', 'Fetched')}: ${dateLabel(state.at, locale)}`}</p>;
  const details = <div className="iw-detail uw-stack">
    <section className="uw-detail-section iw-news-preferences">
      <div className="uw-grid"><Field label={t('新闻来源', 'News source')}><select value={source !== 'gdelt' ? source : language === 'en' ? 'gdelt-en' : 'gdelt-zh'} onChange={e => onChange?.({ newsSource: ['chinanews', 'ecns'].includes(e.target.value) ? e.target.value : 'gdelt', newsLanguage: ['ecns', 'gdelt-en'].includes(e.target.value) ? 'en' : 'zh' })}><option value="chinanews">{t('中新网 · 中文', 'China News Service · Chinese')}</option><option value="ecns">ECNS · English</option><option value="gdelt-zh">GDELT · 中文</option><option value="gdelt-en">GDELT · English</option></select></Field>{source === 'gdelt' && <Field label={t('内容分类', 'Topics')}><select value={category} onChange={e => onChange?.({ category: e.target.value })}><option value="general">{t('综合', 'General')}</option><option value="technology">{t('科技', 'Technology')}</option><option value="world">{t('国际', 'World')}</option></select></Field>}</div>
      <div className="iw-footer-row"><RemoteStatus state={state} locale={locale}/><WidgetButton disabled={state.loading} onClick={state.refresh}><RefreshCw size={14} className={state.loading ? 'iw-refreshing' : ''}/>{state.loading ? t('正在更新…', 'Updating…') : t('刷新新闻', 'Refresh news')}</WidgetButton></div>
    </section>
    <ol className="iw-news-detail-list">{stories.map((story, index) => <li key={story.url}><span>{String(index + 1).padStart(2, '0')}</span><div><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}<ExternalLink/></a><small>{story.source}{story.publishedLabel ? ` · ${t('网站时间', 'Publisher time')} ${story.publishedLabel}` : story.publishedAt ? ` · ${t('发布', 'Published')} ${dateLabel(story.publishedAt, locale)}` : story.observedAt ? ` · ${t('采集', 'Indexed')} ${dateLabel(story.observedAt, locale)}` : ''}</small></div></li>)}</ol>
    {!stories.length && <p className="iw-news-detail-empty iw-muted">{state.loading ? t('正在获取新闻…', 'Fetching news…') : state.error ? t('暂时无法获取新闻。稍后重试，或打开新闻源查看。', 'News is unavailable. Retry later or open the source.') : t('过去 24 小时暂无匹配报道。', 'No matching reports from the past 24 hours.')}</p>}
    {sourceNotes}
  </div>;
  return <WidgetShell title={t('最新新闻', 'Latest news')} preview={preview} className="iw-widget iw-news" actions={refresh} footer={<RemoteStatus state={state} locale={locale} source={sourceName} preview={preview}/>} details={details}>
    {stories.length ? <NewsHeadlineList stories={stories} preview={preview} locale={locale}/> : <div className="iw-news-empty"><div className="iw-news-masthead"><span>{language === 'zh' ? '中文资讯' : 'NEWSROOM'}</span><i/><i/><i/></div><p>{preview ? t('添加后，阅读最新报道。', 'Add to read the latest reports.') : state.loading ? t('正在获取最新报道…', 'Fetching the latest reports…') : state.error ? t('暂时无法连接新闻源', 'News source unavailable') : t('暂无匹配报道', 'No matching reports')}</p><span className="iw-news-source-caption">{language === 'zh' ? t('中文原文 · 来源可追溯', 'Chinese · original sources') : 'English · original sources'}</span></div>}
  </WidgetShell>;
}

const COMPONENTS = { clock: ClockWidget, calendar: CalendarWidget, quote: QuoteWidget, 'codex-usage': UsageWidget, weather: WeatherWidget, news: NewsWidget };
export function InfoWidgetContent({ kind, config = {}, onChange, preview = false, active = true, locale = 'zh-CN' }) {
  const Component = COMPONENTS[kind];
  return Component ? <Component config={config} onChange={onChange} preview={preview} active={active} locale={infoLocale(locale)}/> : null;
}
