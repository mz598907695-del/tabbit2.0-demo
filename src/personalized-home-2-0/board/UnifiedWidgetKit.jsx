import { cloneElement, createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './unified-widget-kit.css';

const WidgetLocale = createContext({ locale: 'zh-CN' });
export function WidgetLocaleProvider({ locale = 'zh-CN', onChange, children }) {
  return <WidgetLocale.Provider value={{ locale, onChange }}>{children}</WidgetLocale.Provider>;
}
export function useWidgetNow(active = true, interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const tick = () => { if (!document.hidden) setNow(new Date()); };
    tick();
    const timer = setInterval(tick, interval);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [active, interval]);
  return now;
}

export function WidgetShell({ title, icon, children, details, preview = false, className = '', footer, actions, status, detailOpen, onDetailOpenChange }) {
  const rootRef = useRef(null), dialogRef = useRef(null), openerRef = useRef(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = detailOpen ?? ownOpen;
  const setOpen = value => { setOwnOpen(value); onDetailOpenChange?.(value); };
  const { locale, onChange } = useContext(WidgetLocale);
  const english = locale.startsWith('en');
  const close = () => { dialogRef.current?.close(); setOpen(false); openerRef.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.showModal();
    // The close control is a predictable focus target; textarea autofocus is
    // deliberately not allowed to steal typing from the browser address bar.
    dialog?.querySelector('.uw-dialog-close')?.focus({ preventScroll: true });
    return () => { if (dialog?.open) dialog.close(); };
  }, [open]);
  const stopBoardGesture = event => { if (event.target.closest('button,a,input,select,textarea,[contenteditable="true"],[data-board-interactive]')) event.stopPropagation(); };
  return <div ref={rootRef} className={`uw-root ${className}`} aria-label={title} lang={locale} onPointerDown={stopBoardGesture}>
    <div className="uw-layout">
      <header className="uw-header"><span className="uw-title" title={title}>{icon && <span className="uw-icon" aria-hidden="true">{icon}</span>}<span>{title}</span></span>
        {status && <span className="uw-pill">{status}</span>}{actions && <div className="uw-header-actions">{actions}</div>}
        {details && <button type="button" ref={openerRef} data-board-interactive="true" className="uw-expand" aria-label={english ? `Open ${title}` : `展开${title}`} disabled={preview} onClick={() => setOpen(true)}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
      </header>
      <div className="uw-main" data-title={title}>{children}</div>
      {footer && <footer className="uw-footer">{footer}</footer>}
    </div>
    {open && details && createPortal(<dialog ref={dialogRef} className={`uw-dialog ${className}`} aria-label={english ? `${title} details` : `${title}详情`} lang={locale} data-board-interactive="true" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }} onClose={() => setOpen(false)}>
      <div className="uw-dialog-panel"><header className="uw-dialog-header"><h2>{title}</h2><div className="uw-dialog-tools">{onChange && <select className="uw-language" aria-label="语言 / Language" value={locale} onChange={event => onChange(event.target.value)}><option value="zh-CN">中文</option><option value="en-US">English</option></select>}<button type="button" className="uw-button uw-dialog-close" aria-label={english ? `Close ${title} details` : `关闭${title}详情`} onClick={close}>{english ? 'Done' : '完成'}</button></div></header><div className="uw-detail-body">{typeof details === 'function' ? details({ close }) : details}</div></div>
    </dialog>, rootRef.current?.closest('.personalized-home') || document.body)}
  </div>;
}
export function Metric({ value, unit, label }) { return <div className="uw-metric" aria-label={label}><strong>{typeof value === 'string' || typeof value === 'number' ? <DotMatrixNumber value={value}/> : value}</strong>{unit && <span>{unit}</span>}</div>; }
export function WidgetButton({ children, className = '', ...props }) { return <button type="button" data-board-interactive="true" className={`uw-button ${className}`} {...props}>{children}</button>; }
export function Field({ label, children }) { const id = useId(); return <div className="uw-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>; }
export function DotProgress({ value, max = 100 }) { const ratio = Math.max(0, Math.min(1, Number(value) / (Number(max) || 1))); return <div className="uw-dots" role="meter" aria-label="进度 / Progress" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max, Math.max(0, Number(value) || 0))}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.round(ratio * 20) ? 'is-filled' : ''}/>)}</div>; }
const GLYPHS = {
  '0':['01110','10001','10001','10001','10001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00001','01110'],
  ':':['0','1','1','0','1','1','0'], '.':['0','0','0','0','0','0','1'], ',':['00','00','00','00','00','01','10'], '-':['000','000','000','111','000','000','000'],
  '+':['00000','00100','00100','11111','00100','00100','00000'], 'e':['00000','00000','01110','10001','11111','10000','01110'], 'E':['11111','10000','10000','11110','10000','10000','11111'],
  '/':['0001','0001','0010','0010','0100','1000','1000'], ' ':['00','00','00','00','00','00','00'],
};
export function DotMatrixNumber({ value, label, className = '' }) {
  const text = String(value ?? '—'); let x = 0; const dots = [];
  const supported = [...text].every(c => GLYPHS[c]);
  if (supported) for (const char of text) { const glyph = GLYPHS[char]; glyph.forEach((row, y) => [...row].forEach((bit, column) => { if (bit === '1') dots.push(<circle key={`${x}-${y}-${column}`} cx={x + column * 8 + 3} cy={y * 8 + 3} r="2.5"/>); })); x += (glyph[0].length + 1.3) * 8; }
  return <span className={`uw-dot-number ${supported ? '' : 'is-text'} ${className}`} style={{ '--uw-dot-aspect': supported ? Math.max(1, x - 8) / 55 : undefined }} role="img" aria-label={label || text}><span className="uw-dot-fallback" aria-hidden="true">{text}</span>{supported && <svg viewBox={`0 0 ${Math.max(1,x - 8)} 55`} preserveAspectRatio="xMinYMid meet" aria-hidden="true" fill="currentColor">{dots}</svg>}</span>;
}
export function TickRing({ value = 0, max = 100, ticks = 60, label, children, className = '' }) {
  const count = Math.min(120, Math.max(12, Math.round(ticks))); const ratio = Math.min(1,Math.max(0, Number(value) / (Number(max) || 1)));
  return <div className={`uw-tick-ring ${className}`} role={label ? 'img' : undefined} aria-label={label}><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">{Array.from({length:count}, (_, i) => { const angle=(i/count*360-90)*Math.PI/180; const inner = i % 5 === 0 ? 71 : 77; return <line key={i} x1={100+Math.cos(angle)*inner} y1={100+Math.sin(angle)*inner} x2={100+Math.cos(angle)*94} y2={100+Math.sin(angle)*94} className={i/count < ratio ? 'is-active' : ''}/>; })}</svg><div className="uw-tick-center">{children}</div></div>;
}
export function DotGrid({ value = 0, max = 100, columns = 10, rows = 5, values, label = '进度 / Progress', className = '' }) {
  const cols = Math.max(1, Math.min(40, Math.round(columns))), total = Math.max(1, Math.min(400, Math.round(rows) * cols));
  const filled = Math.round(Math.min(1,Math.max(0,Number(value)/(Number(max)||1))) * total);
  return <svg className={`uw-dot-grid ${className}`} viewBox={`0 0 ${cols * 12} ${Math.ceil(total / cols) * 12}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>{Array.from({length:total},(_,i) => { const strength=values ? Math.min(1, Math.max(0, Number(values[i]) || 0)) : i < filled ? 1 : 0; return <circle key={i} cx={i % cols * 12 + 6} cy={Math.floor(i / cols) * 12 + 6} r={strength ? 3.2 : 2.2} fill="currentColor" opacity={strength ? .3 + strength * .7 : .09}/>; })}</svg>;
}
export function Sparkline({ values = [], label, className = '' }) {
  const data = values.map(Number).filter(Number.isFinite); const min = Math.min(...data), max = Math.max(...data); const range = max - min || 1;
  const points = data.map((v,i) => `${4+i/Math.max(1,data.length-1)*192},${44-(v-min)/range*36}`).join(' ');
  return <svg className={`uw-sparkline ${className}`} viewBox="0 0 200 50" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></svg>;
}
