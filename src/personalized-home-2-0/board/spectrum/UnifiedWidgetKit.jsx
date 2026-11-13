import { cloneElement, createContext, memo, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { subscribeWidgetClock } from '../widget-clock.js';
import { createPortal } from 'react-dom';
import '../unified-widget-kit.css';
import '../../standard-dialog.css';

const WidgetLocale = createContext({ locale: 'zh-CN' });
export function WidgetLocaleProvider({ locale = 'zh-CN', children }) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <WidgetLocale.Provider value={value}>{children}</WidgetLocale.Provider>;
}
export function useWidgetNow(active = true, interval = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    return subscribeWidgetClock(setNow, interval);
  }, [active, interval]);
  return now;
}

export function WidgetShell({ title, icon, children, details, preview = false, className = '', footer, actions, status, detailOpen, onDetailOpenChange }) {
  const rootRef = useRef(null), dialogRef = useRef(null), openerRef = useRef(null);
  const [ownOpen, setOwnOpen] = useState(false);
  const open = detailOpen ?? ownOpen;
  const setOpen = value => { setOwnOpen(value); onDetailOpenChange?.(value); };
  const { locale } = useContext(WidgetLocale);
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
        {details && <button type="button" ref={openerRef} data-board-interactive="true" className="uw-expand" aria-label={english ? `Open ${title}` : `展开${title}`} disabled={preview} onClick={() => setOpen(true)}><span className="iconfont icon-jiantou-xiangyoushang" aria-hidden="true"/></button>}
      </header>
      <div className="uw-main" data-title={title}>{children}</div>
      {footer && <footer className="uw-footer">{footer}</footer>}
    </div>
    {open && details && createPortal(<dialog ref={dialogRef} className={`uw-dialog standard-dialog ${className}`} aria-label={english ? `${title} details` : `${title}详情`} lang={locale} data-board-interactive="true" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }} onClose={() => setOpen(false)}>
      <div className="uw-dialog-panel"><header className="uw-dialog-header"><h2>{title}</h2><div className="uw-dialog-tools"><button type="button" className="uw-button uw-dialog-close" aria-label={english ? `Close ${title} details` : `关闭${title}详情`} onClick={close}><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button></div></header><div className="uw-detail-body">{typeof details === 'function' ? details({ close }) : details}</div></div>
    </dialog>, rootRef.current?.closest('.v3-scope') || rootRef.current?.closest('.personalized-home') || document.body)}
  </div>;
}
export function Metric({ value, unit, label }) { return <div className="uw-metric" aria-label={label}><strong>{typeof value === 'string' || typeof value === 'number' ? <DotMatrixNumber value={value}/> : value}</strong>{unit && <span>{unit}</span>}</div>; }
export function WidgetButton({ children, className = '', ...props }) { return <button type="button" data-board-interactive="true" className={`uw-button ${className}`} {...props}>{children}</button>; }
export function Field({ label, children }) { const id = useId(); return <div className="uw-field"><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>; }
export function DotProgress({ value, max = 100 }) {
 const ratio=Math.max(0,Math.min(1,Number(value)/(Number(max)||1)));
 return <div className="uw-dots v3-segments" role="meter" aria-label="进度" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(max,Math.max(0,Number(value)||0))}>{Array.from({length:24},(_,i)=><i key={i} className={i<Math.round(ratio*24)?'is-filled':''}/>)}</div>;
}
export const DotMatrixNumber=memo(function DotMatrixNumber({value,label,className=''}) {
 const text=String(value??'—');
 return <span className={`uw-dot-number v3-number is-text ${className}`} role="img" aria-label={label||text}><span className="uw-dot-fallback" aria-hidden="true">{text}</span></span>;
});
export function TickRing({value=0,max=100,label,children,className=''}) {
 const ratio=Math.min(1,Math.max(0,Number(value)/(Number(max)||1)));
 const arc='M38,156 A82,82 0 1 1 162,156';
 return <div className={`uw-tick-ring v3-gauge ${className}`} role={label?'img':undefined} aria-label={label}><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true" fill="none"><path d={arc} pathLength="100"/><path className="is-active" d={arc} pathLength="100" strokeDasharray={`${ratio*100} 100`}/></svg><div className="uw-tick-center">{children}</div></div>;
}
export const DotGrid=memo(function DotGrid({value=0,max=100,columns=20,rows=5,values,label='进度',className=''}) {
 const count=Math.max(1,Math.min(40,Math.round(columns))), ratio=Math.min(1,Math.max(0,Number(value)/(Number(max)||1)));
 const h=rows===1?16:64,step=10;
 return <svg className={`uw-dot-grid v3-bars ${className}`} viewBox={`0 0 ${count*step} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
 {Array.from({length:count},(_,i)=>{const strength=values?Math.max(0,Math.min(1,Number(values[i])||0)):i<count*ratio?1:0;const bar=values?Math.max(4,strength*(h-4)):h-4;return <g key={i}><rect x={i*step+2} y="2" width="5" height={h-4} rx="2.5" className="v3-bar-track"/>{strength>0&&<rect x={i*step+2} y={h-2-bar} width="5" height={bar} rx="2.5" className="v3-bar-lit"/>}</g>;})}
 </svg>;
});
export function Sparkline({values=[],label,className=''}) {
 const data=values.map(Number).filter(Number.isFinite),min=Math.min(...data),max=Math.max(...data),range=max-min||1;
 const points=data.map((v,i)=>`${4+i/Math.max(1,data.length-1)*192},${44-(v-min)/range*36}`).join(' ');
 return <svg className={`uw-sparkline v3-sparkline ${className}`} viewBox="0 0 200 50" preserveAspectRatio="none" role="img" aria-label={label}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></svg>;
}
