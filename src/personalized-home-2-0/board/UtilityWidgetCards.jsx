import { useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, Settings2, X } from "../icons";
import { createVisibleClock, getWorkdayCountdown, normalizeCodexUsageConfig, normalizeWorkdayConfig, splitCountdown } from './utility-widget-data';
import './utility-widget-cards.css';

function useVisibleClock(preview, active, elementRef) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (preview || !active) return undefined;
    const element = elementRef.current;
    if (!element) return undefined;
    const clock = createVisibleClock({ onTick: timestamp => setNow(new Date(timestamp)) });
    let inViewport = typeof IntersectionObserver === 'undefined';
    const updateVisibility = () => clock.setVisible(inViewport && !document.hidden);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      const entry = entries.find(candidate => candidate.target === element);
      if (!entry) return;
      inViewport = entry.isIntersecting && entry.intersectionRatio > 0;
      updateVisibility();
    }, { threshold: .001 });
    observer?.observe(element);
    document.addEventListener('visibilitychange', updateVisibility);
    updateVisibility();
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
      clock.dispose();
    };
  }, [preview, active, elementRef]);
  return now;
}

function UtilityEditor({ title, children, onSave, onCancel }) {
  const firstInput = useRef(null);
  useEffect(() => { firstInput.current?.querySelector('input')?.focus({ preventScroll: true }); }, []);
  return <form className="utility-widget-editor" ref={firstInput} data-board-interactive="true" aria-label={title} onPointerDown={event => event.stopPropagation()}
    onSubmit={event => { event.preventDefault(); onSave(); }}
    onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); onCancel(); } }}>
    <div className="utility-editor-heading"><strong>{title}</strong><button type="button" onClick={onCancel} aria-label="取消设置"><X size={12} /></button></div>
    {children}
    <button type="submit" className="utility-editor-save"><Check size={12} /><span>保存</span></button>
  </form>;
}

export function CodexUsageCard({ config = {}, onChange, preview = false }) {
  const data = normalizeCodexUsageConfig(config);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data);
  const [notice, setNotice] = useState('');
  const settingsRef = useRef(null);
  const timestamp = data.updatedAt && new Date(data.updatedAt);
  const updatedDetail = timestamp ? ` · 更新于 ${timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ' · 未连接账号';
  const updatedLabel = `示例${updatedDetail}`;
  const resetLabel = `${Number(data.resetDate.slice(5, 7))}/${Number(data.resetDate.slice(8, 10))}`;
  const enabled = Boolean(onChange) && !preview;
  function closeEditor() { setEditing(false); settingsRef.current?.focus({ preventScroll: true }); }
  function save() { onChange?.(normalizeCodexUsageConfig({ ...draft, updatedAt: new Date().toISOString() })); closeEditor(); }
  return <div className="widget-content utility-widget-content utility-usage-content">
    <div className="utility-widget-header">
      <div className="utility-widget-heading"><strong title="Codex 用量监测">Codex<span className="utility-usage-title-suffix"> 用量<span className="utility-usage-title-detail">监测</span></span></strong><small title={updatedLabel}><span>示例</span><span className="utility-example-detail">{updatedDetail}</span></small></div>
      <div className="utility-widget-actions" data-board-interactive="true" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <button type="button" aria-label="重新读取 Codex 示例数据" title="重新读取示例数据" disabled={!enabled} onClick={() => { onChange?.({ updatedAt: new Date().toISOString() }); setNotice('已重新读取本地示例，未连接真实账号。'); }}><RefreshCw /></button>
        <button type="button" ref={settingsRef} aria-label="设置 Codex 用量示例" title="设置示例" disabled={!enabled} onClick={() => { setDraft(data); setEditing(true); }}><Settings2 /></button>
      </div>
    </div>
    <div className="utility-usage-body">
      <div className="utility-usage-ring" role="img" aria-label={`示例：7 天已使用 ${data.usedPercent}%`}>
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle className="utility-ring-track" cx="50" cy="50" r="43" /><circle className="utility-ring-progress" cx="50" cy="50" r="43" pathLength="100" strokeDasharray={`${data.usedPercent} 100`} opacity={data.usedPercent ? 1 : 0} /></svg>
        <strong>{data.usedPercent}<span>%</span></strong>
      </div>
      <div className="utility-usage-period"><span>7 天</span><small title={`${data.resetDate} 重置`}>{resetLabel}<span className="utility-reset-word"> 重置</span></small></div>
    </div>
    <span className="widget-sr-only" role="status">{notice}</span>
    {editing && <UtilityEditor title="用量示例设置" onSave={save} onCancel={closeEditor}>
      <label>已用比例<input type="number" min="0" max="100" step="1" required value={draft.usedPercent} onChange={event => setDraft({ ...draft, usedPercent: event.target.value })} aria-label="示例已用比例" /></label>
      <label>重置日期<input type="date" min="1900-01-01" max="9999-12-31" required value={draft.resetDate} onChange={event => setDraft({ ...draft, resetDate: event.target.value })} aria-label="示例重置日期" /></label>
      <p>仅修改本地示例数据</p>
    </UtilityEditor>}
  </div>;
}

export function WorkdayCountdownCard({ config = {}, onChange, preview = false, active = true }) {
  const data = normalizeWorkdayConfig(config);
  const contentRef = useRef(null);
  const now = useVisibleClock(preview, active, contentRef);
  const countdown = getWorkdayCountdown(now, data);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data);
  const settingsRef = useRef(null);
  const groups = splitCountdown(preview ? 10 * 3600 + 51 * 60 + 40 : countdown.remainingSeconds);
  const finished = !preview && countdown.status === 'finished';
  const enabled = Boolean(onChange) && !preview;
  function closeEditor() { setEditing(false); settingsRef.current?.focus({ preventScroll: true }); }
  return <div className="widget-content utility-widget-content utility-workday-content" ref={contentRef}>
    <div className="utility-widget-header">
      <div className="utility-widget-heading"><strong>下班倒计时</strong><small>{finished ? '今天已下班，好好休息' : '美好的一天从下班开始'}</small></div>
      <div className="utility-workday-controls" data-board-interactive="true" onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
        <label><span>上班时间</span><input type="time" value={data.startTime} disabled={!enabled} aria-label="上班时间" onKeyDown={event => event.stopPropagation()} onChange={event => { if (event.target.value) onChange?.({ startTime: event.target.value }); }} /></label>
        <button type="button" ref={settingsRef} aria-label="设置工作时长" title={`工作时长 ${data.workHours} 小时`} disabled={!enabled} onClick={() => { setDraft(data); setEditing(true); }}><Settings2 /></button>
      </div>
    </div>
    <span className="widget-sr-only" role="timer" aria-live="off" aria-atomic="true">{finished ? '今天已下班' : `距离下班 ${groups[0]} 小时 ${groups[1]} 分 ${groups[2]} 秒`}</span>
    <div className={`utility-flip-clock${finished ? ' is-finished' : ''}`} aria-hidden="true">
      {groups.map((group, index) => <span className="utility-clock-group" key={index}>
        {index > 0 && <span className="utility-clock-colon" aria-hidden="true">:</span>}
        {group.split('').map((digit, digitIndex) => <span className="utility-clock-digit" key={digitIndex} aria-hidden="true">{digit}</span>)}
      </span>)}
    </div>
    <span className="utility-workday-compact" aria-hidden="true">{finished ? '已下班' : `${groups[0]}:${groups[1]}`}</span>
    {editing && <UtilityEditor title="下班时间设置" onSave={() => { onChange?.(normalizeWorkdayConfig(draft)); closeEditor(); }} onCancel={closeEditor}>
      <label>上班时间<input type="time" required value={draft.startTime} onChange={event => setDraft({ ...draft, startTime: event.target.value })} aria-label="设置上班时间" /></label>
      <label>工作时长<input type="number" min="1" max="16" step="0.5" required value={draft.workHours} onChange={event => setDraft({ ...draft, workHours: event.target.value })} aria-label="每日工作小时数" /></label>
      <p>按上班时间和时长计算</p>
    </UtilityEditor>}
  </div>;
}
