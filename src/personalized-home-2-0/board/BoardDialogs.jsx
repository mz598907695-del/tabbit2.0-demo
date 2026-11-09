import { getHomeRoot } from "../home-host";
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Grid2X2, Pencil, Plus, Search, X } from "../icons";
import './board-dialogs.css';
import ShortcutCatalog from './ShortcutCatalog';
import FadeText from './FadeText';
import { daysUntil } from './widget-data';
import Composer from '../Composer';
import WidgetAIArtwork from '../WidgetAIArtwork';
import { AIWidgetTreatmentCard } from './AIWidgetTreatment';
import { WIDGET_SKILL, WIDGET_PROMPT } from '../widget-ai-data';
import ShortcutIcon, { ShortcutIconTile } from './ShortcutIcon';
import { shortcutIconFields } from './shortcut-icon';
import { readShortcutIcon, SHORTCUT_ICON_ACCEPT } from './shortcut-icon-upload';
import { MAX_BOARD_ITEMS } from './state';
import { normalizeCodexUsageConfig, normalizeWorkdayConfig } from './utility-widget-data';

const DEFAULT_SIZES = [
  { w: 2, h: 1, label: '横卡' },
  { w: 2, h: 2, label: '标准' },
  { w: 4, h: 2, label: '宽卡' },
];
const KNOWN_KINDS = ['reminder', 'joke', 'image', 'weather', 'calendar', 'countdown', 'draw', 'quote', 'news', 'codex-usage', 'workday-countdown'];
const MAX_NAME_LENGTH = 40;
const MAX_URL_LENGTH = 2048;

export function normalizeBoardShortcutUrl(value) {
  const input = String(value || '').trim();
  if (!input) throw new Error('请输入网址');
  if (input.length > MAX_URL_LENGTH) throw new Error('网址不能超过 2048 个字符');
  const scheme = input.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  const hostWithPort = /^(?:localhost|[\w.-]+\.[a-z\d-]+):\d+(?:[/?#]|$)/i.test(input);
  if (scheme && !['http', 'https'].includes(scheme) && !hostWithPort) {
    throw new Error('仅支持 http 或 https 网址');
  }
  let address;
  try {
    address = new URL(input.startsWith('//') ? `https:${input}` : scheme && !hostWithPort ? input : `https://${input}`);
  } catch {
    throw new Error('请输入有效网址，例如 example.com');
  }
  if (!['http:', 'https:'].includes(address.protocol) || !address.hostname) {
    throw new Error('仅支持 http 或 https 网址');
  }
  if (address.href.length > MAX_URL_LENGTH) throw new Error('网址不能超过 2048 个字符');
  return address.href;
}

function BoardModal({ title, description, className = '', initialFocusRef, skipRestoreFocusRef, anchorRef, homeAnchorRef, onClose, alert = false, header, children }) {
  const id = useId();
  const dialogRef = useRef(null);
  const backdropDown = useRef(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement;
    const home = homeAnchorRef?.current?.closest('.home');
    const anchor = home || anchorRef?.current?.closest('dialog') || anchorRef?.current;
    const position = () => {
      if (!anchor?.isConnected) return;
      const rect = anchor.getBoundingClientRect();
      if (home) {
        const viewport = window.visualViewport;
        const viewLeft = viewport?.offsetLeft || 0, viewTop = viewport?.offsetTop || 0;
        const viewRight = viewLeft + (viewport?.width || innerWidth);
        const viewBottom = viewTop + (viewport?.height || innerHeight);
        let left = Math.max(viewLeft, rect.left), right = Math.min(viewRight, rect.right);
        let top = Math.max(viewTop, rect.top), bottom = Math.min(viewBottom, rect.bottom);
        // On stacked screens the homepage can be below the settings. Keep the
        // modal usable in the visible viewport when its anchor is offscreen.
        if (right - left < 64) { left = viewLeft; right = viewRight; }
        if (bottom - top < 160) { top = viewTop; bottom = viewBottom; }
        dialog.style.maxWidth = `${Math.max(0, right - left - 32)}px`;
        dialog.style.maxHeight = `${Math.max(0, bottom - top - 32)}px`;
        const bounds = dialog.getBoundingClientRect();
        Object.assign(dialog.style, {
          position: 'fixed', inset: 'auto', margin: '0',
          left: `${left + (right - left - bounds.width) / 2}px`,
          top: `${top + (bottom - top - bounds.height) / 2}px`,
        });
        return;
      }
      const bounds = dialog.getBoundingClientRect();
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
      dialog.style.position = 'fixed';
      dialog.style.inset = 'auto';
      dialog.style.margin = '0';
      dialog.style.left = `${Math.max(16, Math.min(innerWidth - bounds.width - 16, (left + right - bounds.width) / 2))}px`;
      dialog.style.top = `${Math.max(16, Math.min(innerHeight - bounds.height - 16, (top + bottom - bounds.height) / 2))}px`;
    };
    if (!dialog.open) dialog.showModal();
    position();
    const observer = anchor ? new ResizeObserver(position) : null;
    if (anchor) { observer.observe(anchor); observer.observe(dialog); window.addEventListener('resize', position); }
    if (home) {
      if (home.parentElement) observer.observe(home.parentElement);
      window.addEventListener('scroll', position, { passive: true });
      window.visualViewport?.addEventListener('resize', position);
      window.visualViewport?.addEventListener('scroll', position);
    }
    (initialFocusRef?.current || dialog.querySelector('[data-board-autofocus], input, textarea, button'))?.focus({ preventScroll: true });
    return () => {
      observer?.disconnect();
      if (anchor) window.removeEventListener('resize', position);
      if (home) {
        window.removeEventListener('scroll', position);
        window.visualViewport?.removeEventListener('resize', position);
        window.visualViewport?.removeEventListener('scroll', position);
      }
      if (dialog.open) dialog.close();
      // A library may be replaced directly by an editor. Do not pull focus out
      // of the new modal, or back into a menu that has already been removed.
      queueMicrotask(() => {
        if (!skipRestoreFocusRef?.current && !document.querySelector('dialog[open]') && opener?.isConnected && typeof opener.focus === 'function') {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, []);

  function outside(event) {
    if (event.target !== dialogRef.current) return false;
    const rect = dialogRef.current.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`board-dialog ${className}`}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      role={alert ? 'alertdialog' : undefined}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onKeyDown={(event) => { event.stopPropagation(); }}
      onPointerDown={(event) => { if (anchorRef) event.stopPropagation(); backdropDown.current = outside(event); }}
      onPointerCancel={(event) => { if (anchorRef) event.stopPropagation(); backdropDown.current = false; }}
      onClick={(event) => {
        // A nested confirmation is portalled beside its parent dialog in the
        // DOM, but React events still bubble through that parent's tree.
        if (anchorRef) event.stopPropagation();
        const dismiss = backdropDown.current && outside(event);
        backdropDown.current = false;
        if (dismiss) onClose();
      }}
    >
      {header ? <>
        <h2 id={`${id}-title`} className="board-dialog-sr-only">{title}</h2>
        {description && <p id={`${id}-description`} className="board-dialog-sr-only">{description}</p>}
        {header}
      </> : <header className="board-dialog-header">
        <div className="board-dialog-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        <button className="board-dialog-close" type="button" aria-label={`关闭${title}`} onClick={onClose}><X size={18} /></button>
      </header>}
      {children}
    </dialog>,
    getHomeRoot(),
  );
}

function initialDraft(item) {
  const config = item?.config || {};
  const usage = item?.kind === 'codex-usage' ? normalizeCodexUsageConfig(config) : {};
  const workday = item?.kind === 'workday-countdown' ? normalizeWorkdayConfig(config) : {};
  return {
    name: String(item?.type === 'widget' ? item.title || '' : item?.label || item?.name || item?.title || ''),
    url: String(item?.url || ''),
    customIcon: item?.customIcon || '',
    text: String(config.text ?? (Array.isArray(config.lines) ? config.lines.map((line) => typeof line === 'string' ? line : line?.text || '').join('\n') : '')),
    caption: String(config.caption ?? config.alt ?? ''),
    city: String(config.city ?? '北京市'),
    temperature: String(config.temperature ?? config.temp ?? '32'),
    condition: String(config.condition ?? '多云'),
    event: String(config.event ?? '新的开始'),
    targetDate: String(config.targetDate ?? ''),
    author: String(config.author ?? ''),
    usedPercent: String(usage.usedPercent ?? 47),
    resetDate: String(usage.resetDate ?? ''),
    startTime: String(workday.startTime ?? '11:00'),
    workHours: String(workday.workHours ?? 8),
    customConfig: JSON.stringify(config, null, 2),
  };
}

export function BoardItemDialog({ item = null, onSave, onClose, embedded = false, disabled = false, feedback, onDraftChange, appearanceTheme = 'light', shortcutShape = 'circle', shortcutSize = 'small' }) {
  const id = useId();
  const nameRef = useRef(null);
  const fieldRefs = useRef({});
  const iconInputRef = useRef(null);
  const iconRequestRef = useRef(0);
  const [draft, setDraft] = useState(() => initialDraft(item));
  const [error, setError] = useState(null);
  const [readingIcon, setReadingIcon] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(item?.url || '');
  const widget = item?.type === 'widget';
  const shortcutEditor = !widget && !embedded;
  const kind = item?.kind;
  const title = widget ? '编辑小组件' : item ? '编辑快捷方式' : '添加快捷方式';

  useEffect(() => {
    setDraft(initialDraft(item));
    setError(null);
    setReadingIcon(false);
    setPreviewUrl(item?.url || '');
    iconRequestRef.current += 1;
    return () => { iconRequestRef.current += 1; };
  }, [item]);

  // Wait for a complete address instead of requesting an icon on each keystroke.
  useEffect(() => {
    if (widget) return;
    const timer = window.setTimeout(() => {
      try { setPreviewUrl(normalizeBoardShortcutUrl(draft.url)); }
      catch { setPreviewUrl(''); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft.url, widget]);

  async function uploadIcon(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const request = ++iconRequestRef.current;
    setReadingIcon(true);
    setError(previous => previous?.field === 'customIcon' ? null : previous);
    try {
      const customIcon = await readShortcutIcon(file);
      if (request !== iconRequestRef.current) return;
      update('customIcon', customIcon);
    } catch (reason) {
      if (request === iconRequestRef.current) setError({ field: 'customIcon', message: reason.message || '图片读取失败，请重新选择' });
    } finally {
      if (request === iconRequestRef.current) setReadingIcon(false);
    }
  }

  function update(field, value) {
    onDraftChange?.();
    setDraft((previous) => ({ ...previous, [field]: value }));
    if (error?.field === field) setError(null);
  }

  function fail(field, message) {
    setError({ field, message });
    (field === 'name' ? nameRef.current : fieldRefs.current[field])?.focus();
  }

  function submit(event) {
    event.preventDefault();
    onDraftChange?.();
    if (disabled || readingIcon) return;
    const name = draft.name.trim();
    if (!name) return fail('name', widget ? '请输入小组件名称' : '请输入快捷方式名称');
    if (name.length > MAX_NAME_LENGTH) return fail('name', '名称不能超过 40 个字符');
    if (!widget) {
      let url;
      try { url = normalizeBoardShortcutUrl(draft.url); }
      catch (reason) { return fail('url', reason.message); }
      const result = onSave({ ...(item || {}), ...shortcutIconFields(item, url, draft.customIcon), type: 'shortcut', label: name, url });
      if (result?.ok === false) fail('name', result.message || '添加失败，请重试');
      else if (embedded && result?.ok) {
        setDraft(initialDraft(null));
        setPreviewUrl('');
        setError(null);
        nameRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    let config = { ...(item.config || {}) };
    if (kind === 'reminder' || kind === 'joke' || kind === 'quote') config.text = draft.text.trim();
    if (kind === 'image') config.caption = draft.caption.trim();
    if (kind === 'weather') {
      if (!draft.city.trim()) return fail('city', '请输入城市名称');
      const temperature = draft.temperature.trim().replace(/°[Cc]?$/, '');
      if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(temperature)) return fail('temperature', '请输入有效温度，例如 26 或 -5');
      if (!draft.condition.trim()) return fail('condition', '请输入天气状况');
      config = { ...config, city: draft.city.trim(), temperature, condition: draft.condition.trim() };
    }
    if (kind === 'quote') config.author = draft.author.trim();
    if (kind === 'countdown') {
      if (!draft.event.trim()) return fail('event', '请输入倒计时名称');
      if (daysUntil(draft.targetDate) === null) return fail('targetDate', '请选择有效日期');
      config = { ...config, event: draft.event.trim(), targetDate: draft.targetDate };
    }
    if (kind === 'codex-usage') {
      const usedPercent = Number(draft.usedPercent);
      if (!draft.usedPercent.trim() || !Number.isInteger(usedPercent) || usedPercent < 0 || usedPercent > 100) return fail('usedPercent', '请输入 0 至 100 的整数');
      if (daysUntil(draft.resetDate) === null) return fail('resetDate', '请选择有效的重置日期');
      config = normalizeCodexUsageConfig({ ...config, usedPercent, resetDate: draft.resetDate, updatedAt: new Date().toISOString() });
    }
    if (kind === 'workday-countdown') {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.startTime)) return fail('startTime', '请选择有效的上班时间');
      const workHours = Number(draft.workHours);
      if (!draft.workHours.trim() || !Number.isFinite(workHours) || workHours < 1 || workHours > 16 || !Number.isInteger(workHours * 2)) return fail('workHours', '工作时长需为 1 至 16 小时，每次增加半小时');
      config = normalizeWorkdayConfig({ ...config, startTime: draft.startTime, workHours });
    }
    if (!KNOWN_KINDS.includes(kind)) {
      try {
        const parsed = JSON.parse(draft.customConfig);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
        config = parsed;
      } catch { return fail('customConfig', '配置需填写有效的 JSON 对象'); }
    }
    const result = onSave({ ...item, title: name, config });
    if (result?.ok === false) fail('name', result.message || '保存失败，请重试');
  }

  function field({ key, label, multiline = false, hint, ...inputProps }) {
    const Input = multiline ? 'textarea' : 'input';
    const invalid = error?.field === key;
    const describedBy = [hint && `${id}-${key}-hint`, invalid && `${id}-error`].filter(Boolean).join(' ') || undefined;
    return <div className="board-dialog-field" key={key}>
      <label className={shortcutEditor ? 'board-dialog-sr-only' : undefined} htmlFor={`${id}-${key}`}>{label}</label>
      <Input
        {...inputProps}
        id={`${id}-${key}`}
        ref={(node) => { fieldRefs.current[key] = node; }}
        value={draft[key]}
        onChange={(event) => update(key, event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      {hint && <p className="board-dialog-hint" id={`${id}-${key}-hint`}>{hint}</p>}
    </div>;
  }

  const previewItem = { ...item, ...shortcutIconFields(item, previewUrl, draft.customIcon), url: previewUrl, label: draft.name };
  const form = <form className={`board-dialog-form${embedded && !widget ? ' board-shortcut-inline' : ''}`} onSubmit={submit} noValidate>
      <div className="board-dialog-body board-dialog-fields">
        {!widget && <div className="board-shortcut-artwork">
          <div className="board-shortcut-icon-preview" aria-busy={readingIcon}>
            {embedded ? <ShortcutIconTile item={previewItem} shape={shortcutShape} iconSize={shortcutSize} appearanceTheme={appearanceTheme} role="img" aria-label={draft.customIcon ? '自定义快捷方式图标' : '网站图标'} />
              : <span className="board-shortcut-icon-image" role="img" aria-label={draft.customIcon ? '自定义快捷方式图标' : '网站图标'}><ShortcutIcon item={previewItem} size={48} appearanceTheme={appearanceTheme} /></span>}
            <button type="button" className="board-shortcut-icon-edit" aria-label="上传自定义图标" title="上传自定义图标" disabled={readingIcon} aria-describedby={error?.field === 'customIcon' ? `${id}-error` : undefined} onClick={() => iconInputRef.current?.click()}><Pencil size={13} strokeWidth={1.8} aria-hidden="true" /></button>
          </div>
          <input ref={iconInputRef} type="file" accept={SHORTCUT_ICON_ACCEPT} hidden onChange={uploadIcon} />
          {draft.customIcon && !embedded && <button type="button" className="board-shortcut-icon-reset" disabled={readingIcon} onClick={() => update('customIcon', '')}>恢复网站图标</button>}
          <span className="board-dialog-sr-only" role="status">{readingIcon ? '正在读取图标' : ''}</span>
        </div>}
        <div className="board-dialog-field">
          {shortcutEditor ? <label className="board-dialog-sr-only" htmlFor={`${id}-name`}>名称</label> : <div className="board-dialog-label-row"><label htmlFor={`${id}-name`}>名称</label><span aria-hidden="true">{draft.name.length}/{MAX_NAME_LENGTH}</span></div>}
          <input ref={nameRef} id={`${id}-name`} value={draft.name} onChange={(event) => update('name', event.target.value)} maxLength={MAX_NAME_LENGTH} placeholder={widget ? '小组件名称' : '例如：我的常用网站'} autoComplete="off" required aria-invalid={error?.field === 'name' || undefined} aria-describedby={error?.field === 'name' ? `${id}-error` : undefined} />
        </div>
        {!widget && field({ key: 'url', label: '网址', placeholder: 'https://example.com', inputMode: 'url', autoComplete: 'url', autoCapitalize: 'none', spellCheck: false, required: true, maxLength: MAX_URL_LENGTH })}
        {widget && kind === 'reminder' && field({ key: 'text', label: '提醒内容', multiline: true, rows: 4, maxLength: 2000, placeholder: '每行填写一条提醒', hint: '卡片展示前两条，其余内容保留在编辑中。' })}
        {widget && kind === 'joke' && field({ key: 'text', label: '笑话内容', multiline: true, rows: 4, maxLength: 2000, placeholder: '写下一句让人轻松的话' })}
        {widget && kind === 'quote' && <>
          {field({ key: 'text', label: '句子', multiline: true, rows: 3, maxLength: 500, placeholder: '留空使用内置每日一句' })}
          {field({ key: 'author', label: '署名', maxLength: 60, placeholder: '选填' })}
        </>}
        {widget && kind === 'countdown' && <>
          {field({ key: 'event', label: '倒计时名称', maxLength: 40, required: true })}
          {field({ key: 'targetDate', label: '目标日期', type: 'date', required: true })}
        </>}
        {widget && kind === 'image' && field({ key: 'caption', label: '图片说明', multiline: true, rows: 3, maxLength: 200, placeholder: '为这片风景写一句话（选填）' })}
        {widget && kind === 'weather' && <>
          {field({ key: 'city', label: '城市', maxLength: 40, autoComplete: 'off', required: true })}
          <div className="board-dialog-field-pair">
            {field({ key: 'temperature', label: '温度（°C）', maxLength: 12, inputMode: 'decimal', required: true })}
            {field({ key: 'condition', label: '天气状况', maxLength: 30, placeholder: '例如：多云', required: true })}
          </div>
          <p className="board-dialog-hint">此处为演示数据，修改后不会查询实时天气。</p>
        </>}
        {widget && kind === 'codex-usage' && <>
          {field({ key: 'usedPercent', label: '已用额度（%）', type: 'number', min: 0, max: 100, step: 1, required: true })}
          {field({ key: 'resetDate', label: '重置日期', type: 'date', required: true })}
          <p className="board-dialog-hint">可配置的 7 天周期示例数据，尚未连接 Codex 账户。</p>
        </>}
        {widget && kind === 'workday-countdown' && <>
          {field({ key: 'startTime', label: '上班时间', type: 'time', required: true })}
          {field({ key: 'workHours', label: '工作时长（小时）', type: 'number', min: 1, max: 16, step: 0.5, required: true })}
          <p className="board-dialog-hint">按本机时间计算，每天从上班时间起计时。</p>
        </>}
        {widget && !KNOWN_KINDS.includes(kind) && field({ key: 'customConfig', label: '组件配置', multiline: true, rows: 6, spellCheck: false, className: 'board-dialog-code' })}
        {error && !embedded && <p className="board-dialog-error" id={`${id}-error`} role="alert">{error.message}</p>}
      </div>
      {embedded ? <div className="board-shortcut-actions">
        {error && <p className="board-dialog-error" id={`${id}-error`} role="alert" title={error.message}>{error.message}</p>}
        {draft.customIcon && !error && <button type="button" className="board-shortcut-icon-reset" disabled={readingIcon} onClick={() => update('customIcon', '')}>恢复网站图标</button>}
        <p className="board-dialog-sr-only" role="status" aria-live="polite">{feedback || ''}</p>
        <button type="submit" className="board-dialog-primary" disabled={disabled || readingIcon}>添加</button>
      </div> : <footer className="board-dialog-footer">
        <button type="button" className="board-dialog-secondary" onClick={onClose}>取消</button>
        <button type="submit" className="board-dialog-primary" disabled={disabled || readingIcon}>{item ? '保存' : '添加'}</button>
      </footer>}
    </form>;
  return embedded ? form : <BoardModal title={title} className={shortcutEditor ? 'board-shortcut-editor' : ''} initialFocusRef={nameRef} onClose={onClose}>{form}</BoardModal>;
}

function LibraryPreview({ preview }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [preview]);
  if (!preview || failed) return <div className="board-library-preview-placeholder"><Grid2X2 size={32} /></div>;
  if (typeof preview === 'string') return <img className="board-library-preview-image" src={preview} alt="" onError={() => setFailed(true)} draggable="false" />;
  return <div className="board-library-preview-content">{preview}</div>;
}

const LIBRARY_TABS = [
  { id: 'shortcuts', label: '快捷方式' },
  { id: 'widgets', label: '小组件' },
];

function LibrarySearch({ value, onChange, placeholder }) {
  const id = useId();
  const [expanded, setExpanded] = useState(Boolean(value));
  const inputRef = useRef(null);
  const buttonRef = useRef(null);

  function open() {
    setExpanded(true);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  }

  return <div className={`board-library-search${expanded ? ' is-expanded' : ''}`}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !value.trim()) setExpanded(false); }}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !expanded) return;
      event.preventDefault(); event.stopPropagation();
      onChange(''); setExpanded(false); buttonRef.current?.focus();
    }}>
    <button ref={buttonRef} type="button" className="board-library-search-toggle" aria-label={placeholder} title={placeholder} aria-expanded={expanded} aria-controls={id} onClick={open}><Search size={17} aria-hidden="true" /></button>
    <div className="board-library-search-field" inert={!expanded} aria-hidden={!expanded}>
      <input ref={inputRef} id={id} type="search" value={value} placeholder={placeholder} aria-label={placeholder} tabIndex={expanded ? 0 : -1} onChange={event => onChange(event.target.value)} />
      {value && <button type="button" className="board-library-search-clear" aria-label="清空搜索" onClick={() => { onChange(''); inputRef.current?.focus(); }}><X size={13} aria-hidden="true" /></button>}
    </div>
  </div>;
}

export function BoardLibrary({ catalog = [], pages = [], currentPageId, onAdd, onShortcut, onGenerateWidget, onClose, homeAnchorRef, shortcutShape = 'circle', shortcutSize = 'small', appearanceTheme = 'light' }) {
  const id = useId();
  const [category, setCategory] = useState('widgets');
  const [aiComposerFocused, setAIComposerFocused] = useState(false);
  const [targetId, setTargetId] = useState(() => pages.find(page => page.id === currentPageId)?.id || pages[0]?.id || '');
  const [sizeKeys, setSizeKeys] = useState({});
  const [feedback, setFeedback] = useState({});
  const [toast, setToast] = useState({ id: 0, message: '', visible: false });
  const [queries, setQueries] = useState({ shortcuts: '', widgets: '' });
  const firstFocusRef = useRef(null);
  const skipRestoreFocusRef = useRef(false);
  const categoryRefs = useRef({});
  const sizeRefs = useRef({});
  const bodyRef = useRef(null);
  const aiComposerRef = useRef(null);
  const successTimers = useRef({});
  const toastTimer = useRef(null);
  const targetPage = pages.find(page => page.id === targetId) || pages.find(page => page.id === currentPageId) || pages[0];
  const targetPageId = targetPage?.id || '';
  const full = Boolean(targetPage && (targetPage.items?.length || 0) >= MAX_BOARD_ITEMS);
  const unavailable = !targetPage || full;
  const capacityMessage = !targetPage ? '暂无可添加的页面。' : full ? `此页面已达到 ${MAX_BOARD_ITEMS} 项上限，请选择其他页面。` : '';
  const widgetQuery = queries.widgets.trim().toLocaleLowerCase();
  const visibleCatalog = catalog.filter(item => `${item.title} ${item.description || ''}`.toLocaleLowerCase().includes(widgetQuery));
  const showAICard = Boolean(onGenerateWidget && (!widgetQuery || 'ai 生成 定制小组件 个性化你的首页'.includes(widgetQuery)));

  useEffect(() => {
    if (category !== 'widgets' || !showAICard) aiComposerRef.current?.closeOverlays();
  }, [category, showAICard]);

  useEffect(() => {
    if (targetId !== targetPageId) setTargetId(targetPageId);
  }, [targetId, targetPageId]);
  useEffect(() => () => {
    Object.values(successTimers.current).forEach(clearTimeout);
    clearTimeout(toastTimer.current);
  }, []);

  function dismissToast() {
    clearTimeout(toastTimer.current);
    setToast(previous => ({ ...previous, visible: false }));
  }

  function showAddedToast(name) {
    clearTimeout(toastTimer.current);
    setToast(previous => ({ id: previous.id + 1, message: `已添加 ${name} 到「${targetPage.name}」`, visible: true }));
    toastTimer.current = window.setTimeout(() => {
      setToast(previous => ({ ...previous, visible: false }));
    }, 2600);
  }

  function changeCategory(next) {
    setCategory(next);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }

  function navigateCategory(event, index) {
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = LIBRARY_TABS.length - 1;
    else if (event.key === 'ArrowRight') next = (index + 1) % LIBRARY_TABS.length;
    else if (event.key === 'ArrowLeft') next = (index + LIBRARY_TABS.length - 1) % LIBRARY_TABS.length;
    else return;
    event.preventDefault();
    changeCategory(LIBRARY_TABS[next].id);
    categoryRefs.current[LIBRARY_TABS[next].id]?.focus();
  }

  function selectSize(kind, size) {
    setSizeKeys(previous => ({ ...previous, [kind]: `${size.w}-${size.h}` }));
  }

  function navigateSize(event, kind, choices, index) {
    let next;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = choices.length - 1;
    else if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % choices.length;
    else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + choices.length - 1) % choices.length;
    else return;
    event.preventDefault();
    const size = choices[next];
    selectSize(kind, size);
    sizeRefs.current[`${kind}-${size.w}-${size.h}`]?.focus();
  }

  function addWidget(item, size) {
    if (unavailable) return;
    const result = onAdd?.(item.kind, { ...size, label: size.label || `${size.w} × ${size.h}` }, targetPageId);
    clearTimeout(successTimers.current[item.kind]);
    const ok = result?.ok === true;
    if (ok) showAddedToast(item.title);
    else dismissToast();
    setFeedback(previous => ({ ...previous, [item.kind]: {
      ok, checked: ok, targetPageId,
      message: ok ? `已添加到「${targetPage.name}」` : result?.message || '添加失败，请重试。',
    } }));
    if (ok) successTimers.current[item.kind] = window.setTimeout(() => {
      setFeedback(previous => ({ ...previous, [item.kind]: { ...previous[item.kind], checked: false } }));
      delete successTimers.current[item.kind];
    }, 1600);
  }

  function addShortcut(value) {
    if (unavailable) return { ok: false, message: capacityMessage };
    const result = onShortcut?.(value, targetPageId);
    if (result?.ok === true) showAddedToast(value.label);
    else dismissToast();
    return result || { ok: false, message: '添加失败，请重试。' };
  }

  function generateWidget(draft = null) {
    // The next screen owns focus; do not return it to the gallery's opener.
    skipRestoreFocusRef.current = true;
    onClose();
    onGenerateWidget?.(draft);
  }

  const header = <header className="board-library-header">
    <div className="board-library-destination">
      <label htmlFor={`${id}-page`}>添加到</label>
      <span className="overlay-select-wrap"><select id={`${id}-page`} aria-describedby={capacityMessage ? `${id}-capacity` : undefined} value={targetPageId} disabled={!pages.length} onChange={event => { setTargetId(event.target.value); setFeedback({}); dismissToast(); }}>
        {pages.length ? pages.map(page => <option key={page.id} value={page.id}>{page.name}{(page.items?.length || 0) >= MAX_BOARD_ITEMS ? '（已满）' : ''}</option>) : <option value="">暂无页面</option>}
      </select><ChevronDown size={12} aria-hidden="true" /></span>
    </div>
    <div className="board-library-tabs" role="tablist" aria-label="添加内容类型">
      {LIBRARY_TABS.map((entry, index) => <button
        key={entry.id}
        id={`${id}-category-${entry.id}`}
        type="button"
        role="tab"
        aria-selected={category === entry.id}
        aria-controls={`${id}-panel-${entry.id}`}
        tabIndex={category === entry.id ? 0 : -1}
        ref={node => { categoryRefs.current[entry.id] = node; if (entry.id === 'widgets') firstFocusRef.current = node; }}
        onClick={() => changeCategory(entry.id)}
        onKeyDown={event => navigateCategory(event, index)}
      >{entry.label}</button>)}
    </div>
    <div className="board-library-header-actions">
    <LibrarySearch key={category} value={queries[category]} onChange={value => setQueries(current => ({ ...current, [category]: value }))} placeholder={category === 'shortcuts' ? '搜索网站' : '搜索小组件'} />
    <button className="board-dialog-close" type="button" aria-label="关闭添加内容" onClick={onClose}><X size={18} /></button></div>
  </header>;

  return <BoardModal title="添加内容" className="board-library-dialog" homeAnchorRef={homeAnchorRef} initialFocusRef={firstFocusRef} skipRestoreFocusRef={skipRestoreFocusRef} header={header} onClose={onClose}>
    <div ref={bodyRef} className="board-dialog-body board-library-body">
      {capacityMessage && <p className="board-library-capacity" id={`${id}-capacity`} role="status" aria-live="polite">{capacityMessage}</p>}
      <div className="board-library-panel" id={`${id}-panel-shortcuts`} role="tabpanel" aria-labelledby={`${id}-category-shortcuts`} hidden={category !== 'shortcuts'}>
        <ShortcutCatalog query={queries.shortcuts} scrollContainerRef={bodyRef} active={category === 'shortcuts'} targetId={targetPageId} disabled={unavailable || !onShortcut} onAdd={addShortcut} shortcutShape={shortcutShape} shortcutSize={shortcutSize} appearanceTheme={appearanceTheme} customForm={<BoardItemDialog embedded disabled={unavailable || !onShortcut} onSave={addShortcut} shortcutShape={shortcutShape} shortcutSize={shortcutSize} appearanceTheme={appearanceTheme} />} />
      </div>
      <div className="board-library-panel" id={`${id}-panel-widgets`} role="tabpanel" aria-labelledby={`${id}-category-widgets`} hidden={category !== 'widgets'} tabIndex={0}>
      <div className="board-library-grid">
        {onGenerateWidget && <AIWidgetTreatmentCard hidden={!showAICard} active={category === 'widgets'} onFocusChange={setAIComposerFocused}>
          <div className="board-library-ai-intro">
            <WidgetAIArtwork animate active={category === 'widgets' && showAICard} paused={aiComposerFocused} />
            <h3>个性化你的首页</h3>
          </div>
          <Composer ref={aiComposerRef} initialSkill={WIDGET_SKILL} initialQuery={WIDGET_PROMPT} simple onHandoff={generateWidget} />
        </AIWidgetTreatmentCard>}
        {visibleCatalog.map(item => {
          const choices = DEFAULT_SIZES;
          const selectedSize = choices.find(size => `${size.w}-${size.h}` === sizeKeys[item.kind])
            || choices.find(size => size.w === item.defaultSize?.w && size.h === item.defaultSize?.h)
            || choices[1];
          const itemFeedback = feedback[item.kind]?.targetPageId === targetPageId ? feedback[item.kind] : null;
          // Keep all presets inside one steady preview stage; only the card's proportion changes.
          const cardWidth = 50 + (selectedSize.w - 1) * 81.25;
          const cardHeight = 50 + (selectedSize.h - 1) * 81.25;
          const previewWidth = cardWidth * Math.min(1.3, 214 / cardHeight);
          return <article key={item.kind} className="board-library-card" data-library-kind={item.kind} aria-labelledby={`${id}-${item.kind}-title`}>
            <div className="board-library-preview-stage">
              <div className="board-library-preview-frame" style={{ '--library-preview-width': `${previewWidth}px`, aspectRatio: `${cardWidth} / ${cardHeight}` }} data-size={`${selectedSize.w}x${selectedSize.h}`}>
                <div className="board-library-preview" inert aria-hidden="true"><LibraryPreview preview={item.preview} /></div>
                <button
                  type="button"
                  className={`board-library-add${itemFeedback?.checked ? ' is-added' : ''}`}
                  aria-label={`添加${item.title}`}
                  aria-describedby={unavailable ? `${id}-capacity` : itemFeedback && !itemFeedback.ok ? `${id}-${item.kind}-feedback` : undefined}
                  disabled={unavailable || !onAdd}
                  data-tooltip={itemFeedback?.checked ? '继续添加' : `添加${item.title}`}
                  onClick={() => addWidget(item, selectedSize)}
                >{itemFeedback?.checked ? <Check size={17} strokeWidth={2.5} /> : <Plus size={18} strokeWidth={2.2} />}</button>
              </div>
            </div>
            <div className="board-library-sizes" role="radiogroup" aria-label={`${item.title}尺寸`}>
              {choices.map((size, index) => {
                const key = `${size.w}-${size.h}`;
                const selected = size === selectedSize;
                const label = `${size.w} × ${size.h}`;
                return <button type="button" key={key} className="board-library-size" role="radio" aria-checked={selected} aria-label={label} tabIndex={selected ? 0 : -1} ref={node => { sizeRefs.current[`${item.kind}-${key}`] = node; }} onClick={() => selectSize(item.kind, size)} onKeyDown={event => navigateSize(event, item.kind, choices, index)}><span aria-hidden="true" /></button>;
              })}
            </div>
            <div className="board-library-copy">
              <h3 className="board-library-title" id={`${id}-${item.kind}-title`}>{item.title}</h3>
              <FadeText>{item.description}</FadeText>
              <div className={itemFeedback && !itemFeedback.ok ? 'board-library-feedback is-error' : 'board-dialog-sr-only'} id={`${id}-${item.kind}-feedback`} role="status" aria-live="polite" aria-atomic="true">{itemFeedback && !itemFeedback.ok ? itemFeedback.message : ''}</div>
            </div>
          </article>;
        })}
      </div>
      {!visibleCatalog.length && !showAICard && <p className="board-library-empty">{widgetQuery ? '没有找到相关小组件。' : '此分类暂无小组件。'}</p>}
      {onGenerateWidget && <p className="board-library-generate">
        没找到满意的？试试通过 <button type="button" aria-label="AI 生成小组件" onClick={() => generateWidget()}>AI 生成</button>小组件
      </p>}
      </div>
    </div>
    <div className={`board-library-toast${toast.visible ? ' is-visible' : ''}`} role="status" aria-live="polite" aria-atomic="true" aria-hidden={!toast.visible}>
      <Check size={16} strokeWidth={2} aria-hidden="true" />
      <span key={toast.id}>{toast.message}</span>
    </div>
  </BoardModal>;
}

export function BoardConfirm({ title, description, onConfirm, onClose, confirmLabel = '确认', className = '', anchorRef }) {
  const cancelRef = useRef(null);
  return <BoardModal title={title} description={description} className={`board-confirm-dialog ${className}`} initialFocusRef={cancelRef} anchorRef={anchorRef} onClose={onClose} alert>
    <footer className="board-dialog-footer">
      <button ref={cancelRef} type="button" className="board-dialog-secondary" onClick={onClose}>取消</button>
      <button type="button" className="board-dialog-primary" onClick={onConfirm}>{confirmLabel}</button>
    </footer>
  </BoardModal>;
}
