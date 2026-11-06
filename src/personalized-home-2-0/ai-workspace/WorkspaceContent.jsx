/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bell, Bookmark, CalendarClock, Check, Cloud, Copy, Code2, CreditCard, File, FileImage, FileText, Folder, Gauge, Globe, House, LayoutDashboard, Lightbulb, MessageCircle, Monitor, Pause, Pin, Play, Plus, Search, Share2, Sparkles, Table2, Ticket, Upload, X } from '../icons';
import { MODULES, PAGE_TABS, TYPE_LABELS, filterWorkspaceItems } from './workspace-data';
import './workspace-content.css';
import { WorkspaceFiles, WorkspaceFilesHeader } from './WorkspaceFiles';
import WorkspacePageHeader from './WorkspacePageHeader';
import WorkspaceSkills from './WorkspaceSkills';
import WorkspaceTasks from './WorkspaceTasks';
import WorkspaceSkillDetail from './WorkspaceSkillDetail';
import { getFileShareText, refreshWorkspaceOutputs } from './file-actions';
import { getSkillCatalogue, saveSkill } from './workspace-skills';
import { getWorkspaceItems, outputCollection, updateWorkspaceOutput } from './workspace-outputs';

const ICONS = { chats: MessageCircle, files: Folder, skills: Lightbulb, tasks: CalendarClock, assets: LayoutDashboard, bookmarks: Bookmark, shares: Share2, usage: Gauge, notifications: Bell };
const FILE_ICONS = { doc: FileText, image: FileImage, table: Table2, web: Globe, other: Code2 };
const GRID_PAGES = new Set(['files', 'skills', 'assets', 'tasks']);
const DEFAULT_UI = { query: '', filter: 'all', kind: 'all', sort: 'recent', view: 'grid' };
const id = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
function IconBadge({ icon: Icon = File, tone = '' }) { return <span className={`aiw-content-icon ${tone}`}><Icon size={20} strokeWidth={1.6} /></span>; }
function EmptyState({ icon: Icon = Search, title = '没有找到相关内容', description = '换个关键词或筛选条件试试。', action, onAction }) {
  return <div className="aiw-empty"><span className="aiw-empty-icon"><Icon size={30} strokeWidth={1.3} /></span><h3>{title}</h3><p>{description}</p>{action && <button className="aiw-button aiw-button-primary" onClick={onAction}><Plus size={16} />{action}</button>}</div>;
}
function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  const previousFocus = useRef(typeof document === 'undefined' ? null : document.activeElement);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    node?.querySelector('[data-aiw-autofocus]')?.focus({ preventScroll: true });
    return () => {
      if (node?.open) node.close();
      requestAnimationFrame(() => {
        const target = previousFocus.current;
        // Do not steal focus if an action opened another page or dialog.
        if (node?.open || !target?.isConnected || target.closest('[inert]') || !target.getClientRects().length) return;
        if (document.activeElement === document.body || document.activeElement === target || node?.contains(document.activeElement)) target.focus?.({ preventScroll: true });
      });
    };
  }, []);
  return <dialog ref={ref} aria-label={title} className={`aiw-content-dialog ${wide ? 'aiw-dialog-wide' : ''}`} onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="aiw-dialog-heading"><h2>{title}</h2><button className="aiw-content-icon-button" aria-label="关闭对话框" onClick={onClose}><X size={18} /></button></div>{children}
  </dialog>;
}
function CreateForm({ page, onClose, onSave, defaultType }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [type, setType] = useState(defaultType || ({ files: 'doc', skills: 'prompt', tasks: 'daily', assets: 'board', bookmarks: 'AI', shares: 'chat' })[page] || 'cloud');
  const [url, setUrl] = useState(''); const [time, setTime] = useState('09:00'); const [error, setError] = useState(''); const [file, setFile] = useState(null);
  const title = page === 'files' ? '创建 AI 输出物' : page === 'assets' && defaultType === 'card' ? '添加 AI 卡片' : MODULES.find(module => module.id === page)?.action || '添加内容';
  function submit(event) {
    event.preventDefault();
    if (!name.trim()) { setError('请填写名称。'); return; }
    if (page === 'bookmarks') { try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(); } catch { setError('请填写完整的 HTTP 或 HTTPS 网页地址。'); return; } }
    onSave({ name: name.trim(), description: description.trim(), type, url, time, file });
  }
  return <Modal title={title} onClose={onClose}><form className="aiw-content-form" onSubmit={submit}>
    <p className="aiw-form-note">仅保存在此浏览器中，方便比较方案。不会连接账号或执行真实任务。</p>
    {((page === 'files' && type !== 'board') || (page === 'assets' && type === 'card')) && <label className="aiw-file-picker"><Upload size={20}/><span>{file?.name || '选择本机文件'}</span><input type="file" aria-label="选择本机文件" onChange={event => { const picked = event.target.files?.[0]; if (picked) { setFile({ name: picked.name, size: picked.size }); setName(picked.name); } }} /></label>}
    <label>名称<input aria-label="名称" data-aiw-autofocus value={name} maxLength={100} onChange={event => setName(event.target.value)} placeholder={page === 'tasks' ? '例如：每天一份行业简报' : '给它起个容易找到的名字'} required /></label>
    {page === 'bookmarks' && <label>网页地址<input aria-label="网页地址" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" required /></label>}
    <label>{page === 'skills' ? '提示词 / 执行说明' : page === 'tasks' ? '任务内容' : '说明'}<textarea aria-label={page === 'skills' ? '提示词 / 执行说明' : page === 'tasks' ? '任务内容' : '说明'} value={description} rows={3} onChange={event => setDescription(event.target.value)} placeholder={page === 'skills' ? '描述你希望 AI 如何完成这件事…' : '补充一点内容，方便以后找到。'} /></label>
    {page === 'tasks' ? <div className="aiw-form-columns"><label>重复<select aria-label="重复" value={type} onChange={event => setType(event.target.value)}><option value="daily">每天</option><option value="weekly">每周五</option></select></label><label>时间<input aria-label="时间" type="time" value={time} onChange={event => setTime(event.target.value)} required /></label></div> : <label>{page === 'bookmarks' ? '收藏夹' : '类型'}<select aria-label={page === 'bookmarks' ? '收藏夹' : '类型'} value={type} onChange={event => setType(event.target.value)}>{(page === 'files' ? PAGE_TABS.files.slice(1) : page === 'skills' ? [['prompt', '提示词'], ['script', '网页脚本'], ['task', '任务']] : page === 'assets' ? [['board', '看板'], ['card', 'AI 卡片']] : page === 'bookmarks' ? PAGE_TABS.bookmarks.slice(1) : page === 'shares' ? PAGE_TABS.shares.slice(1) : [['cloud', '云端'], ['local', '本地']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    {error && <p className="aiw-form-error" role="alert">{error}</p>}
    <div className="aiw-dialog-actions"><button type="button" className="aiw-button" onClick={onClose}>取消</button><button className="aiw-button aiw-button-primary" type="submit">{page === 'tasks' ? '保存示例任务' : '添加'}</button></div>
  </form></Modal>;
}
function ShareOutput({ item, onClose }) {
  const [feedback, setFeedback] = useState('');
  const text = getFileShareText(item);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setFeedback('已复制分享内容'); }
    catch { setFeedback('复制未成功，可选中下方内容手动复制。'); }
  }
  return <Modal title="分享输出物" onClose={onClose}><div className="aiw-content-form aiwf-share-form">
    <h3>{item.title}</h3>
    <label>分享内容<textarea aria-label="分享内容" readOnly value={text} rows={5}/></label>
    <p className="aiw-form-note">当前可复制本地示例摘要，暂不生成公开链接。</p>
    {feedback && <p role="status">{feedback}</p>}
    <div className="aiw-dialog-actions"><button className="aiw-button" onClick={onClose}>关闭</button><button className="aiw-button aiw-button-primary" data-aiw-autofocus onClick={copy}><Copy size={16}/>复制分享内容</button></div>
  </div></Modal>;
}

function DetailFrame({ inline, title, onClose, wide, children }) {
  if (!inline) return <Modal title={title} onClose={onClose} wide={wide}>{children}</Modal>;
  return <aside className="aiw-inspector" aria-label="内容预览" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    <div className="aiw-inspector-heading"><span>内容预览</span><button className="aiw-content-icon-button" aria-label="关闭内容预览" onClick={onClose}><X size={17}/></button></div>
    <h2 className="aiw-inspector-title" aria-live="polite">{title}</h2>{children}
  </aside>;
}
function Detail({ page, item, onClose, onNavigate, onNewChat, onUpdate, inline = false }) {
  const [draft, setDraft] = useState(''); const [messages, setMessages] = useState([]);
  const bodyRef = useRef(null);
  const focusedControl = useRef(null);
  useEffect(() => {
    // Preserve the active control when responsive layout changes the detail shell.
    const label = focusedControl.current;
    if (!label) return;
    const frame = requestAnimationFrame(() => {
      const control = [...(bodyRef.current?.querySelectorAll('[aria-label]') || [])].find(node => node.getAttribute('aria-label') === label);
      control?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [inline]);
  const Icon = page === 'files' ? FILE_ICONS[item.type] || File : ICONS[page] || File;
  return <DetailFrame inline={inline} title={item.title} onClose={onClose} wide={page === 'chats'}>
    <div ref={bodyRef} className="aiw-detail-body" onFocusCapture={event => { focusedControl.current = event.target.getAttribute('aria-label'); }} onBlurCapture={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) focusedControl.current = null; }}><div className="aiw-detail-meta"><Icon size={16}/><span>{page === 'skills' ? `${item.author} · ${TYPE_LABELS[item.skillType]}` : TYPE_LABELS[item.type] || item.type}</span>{item.date && <><span>·</span><span>{item.date}</span></>}<span className="aiw-demo-badge">示例</span></div>
      {page === 'files' && item.image && <img className="aiw-detail-image" src={item.image} alt={item.title} />}
      <p className="aiw-detail-description">{item.description}</p>
      {page === 'chats' ? <><div className="aiw-chat-message aiw-chat-user">{item.title}</div><div className="aiw-chat-message"><span className="aiw-chat-avatar"><Sparkles size={16}/></span><div className="aiw-chat-markdown"><p>可以先把这件事分成三个部分：</p><ol><li>明确现在要解决的问题与使用场景。</li><li>把信息按重要性整理成清晰的结构。</li><li>用一个小版本验证，再根据反馈继续调整。</li></ol><p>这是一段用于比较页面框架的示例对话。</p></div></div>{messages.map((message, index) => message.role === 'user' ? <div className="aiw-chat-message aiw-chat-user" key={index}>{message.text}</div> : <div className="aiw-chat-message" key={index}><span className="aiw-chat-avatar"><Sparkles size={16}/></span><div className="aiw-chat-markdown"><p>{message.text}</p></div></div>)}<form className="aiw-detail-composer" onSubmit={event => { event.preventDefault(); if (!draft.trim()) return; setMessages(previous => [...previous, { role: 'user', text: draft }, { role: 'assistant', text: '已记录这条示例消息。此原型用于体验导航和内容框架，尚未连接 AI 服务。' }]); setDraft(''); }}><input aria-label="继续对话" value={draft} onChange={event => setDraft(event.target.value)} placeholder="继续这个话题…"/><button className="aiw-button aiw-button-primary" disabled={!draft.trim()} aria-label="发送示例消息"><ArrowRight size={16}/></button></form></> : page === 'skills' ? <><div className="aiw-detail-section"><h3>使用说明</h3><p>{item.prompt || item.description}</p></div><div className="aiw-dialog-actions">{item.type !== 'custom' && <button className="aiw-button" onClick={() => { onUpdate({ ...item, type: item.type === 'installed' ? 'official' : item.type, installed: !(item.installed || item.type === 'installed') }); }}>{item.installed || item.type === 'installed' ? '移除已安装' : '添加到我的妙招'}</button>}<button className="aiw-button aiw-button-primary" onClick={() => { onClose(); onNewChat?.(item.prompt || item.description); }}><ArrowUpRight size={16}/>在对话中使用</button></div></> : page === 'tasks' ? <><div className="aiw-detail-section"><h3>执行安排</h3><p>{item.schedule} · {item.type === 'active' ? '生效中' : '已暂停'}</p><h3>最近一次运行</h3><p>{item.lastRun || '尚未运行'}</p></div><p className="aiw-form-note">任务为本地示例，定时执行尚未连接。</p><div className="aiw-dialog-actions"><button className="aiw-button aiw-button-primary" onClick={() => onUpdate({ ...item, type: item.type === 'active' ? 'paused' : 'active' })}>{item.type === 'active' ? '暂停任务' : '恢复任务'}</button></div></> : page === 'files' ? <><div className="aiw-detail-section"><h3>文件信息</h3><dl><dt>格式</dt><dd>{item.format}</dd><dt>大小</dt><dd>{item.size}</dd><dt>来自</dt><dd>{item.source || '本机添加'}</dd></dl></div><div className="aiw-dialog-actions"><button className="aiw-button" onClick={() => { onClose(); onNavigate?.('chats'); }}><MessageCircle size={16}/>查看相关对话</button></div></> : page === 'bookmarks' ? <><div className="aiw-detail-section"><h3>收藏信息</h3><p>{item.domain || item.url}</p><p>收藏夹：{item.type}</p></div>{item.url && <a className="aiw-button" href={item.url} target="_blank" rel="noreferrer">打开网页<ArrowUpRight size={16}/></a>}</> : page === 'shares' ? <><div className="aiw-detail-section"><h3>分享状态</h3><p>{item.enabled ? '链接已启用' : '链接已停用'} · {item.views} 次示例访问</p><p>此原型不会创建公开链接。</p></div><button className="aiw-button" onClick={() => onUpdate({ ...item, enabled: !item.enabled })}>{item.enabled ? '停用示例链接' : '启用示例链接'}</button></> : page === 'notifications' ? <div className="aiw-dialog-actions"><button className="aiw-button" onClick={() => { onClose(); onNavigate?.(item.type === 'billing' ? 'usage' : item.type === 'product' ? 'skills' : 'chats'); }}>查看相关内容<ArrowRight size={16}/></button></div> : <><div className="aiw-detail-section"><h3>{item.type === 'board' ? '看板内容' : item.type === 'card' ? '卡片说明' : '首页内容'}</h3><p>{item.type === 'board' ? '集中存放相关文件、网页和对话，方便回到同一个上下文。' : item.type === 'card' ? '这张卡片可以加入你的首页，随时查看需要的信息。' : '这个示例首页收纳常用快捷方式和小组件。'}</p></div><button className="aiw-button" onClick={() => { onClose(); onNavigate?.(item._outputSource?.type === 'home' || item.type === 'home' ? 'home' : 'files'); }}>打开{item._outputSource?.type === 'home' || item.type === 'home' ? '首页' : '相关资料'}<ArrowRight size={16}/></button></>}
    </div>
  </DetailFrame>;
}
function UsagePanel({ filter, onNavigate, onPlans }) {
  const [used, setUsed] = useState(() => { try { return localStorage.getItem('personalized-home-2-0-ai-workspace-coupon-used-v1') === 'true'; } catch { return false; } });
  const useCoupon = () => { setUsed(true); try { localStorage.setItem('personalized-home-2-0-ai-workspace-coupon-used-v1', 'true'); } catch { /* Session-only fallback. */ } };
  if (filter === 'coupons') return <><div className="aiw-section-caption">可用重置券 <span>{used ? 0 : 1}</span></div><article className="aiw-coupon"><IconBadge icon={Ticket}/><div><h3>周用量重置券</h3><p>立即开始一个新的用量周期</p><small>有效期至 2026 年 11 月 30 日</small></div><button className="aiw-button" disabled={used} onClick={useCoupon}>{used ? '示例券已使用' : '体验使用'}</button></article><p className="aiw-form-note">示例操作不会更改真实账号用量。</p></>;
  if (filter === 'orders') return <div className="aiw-table-wrap"><table className="aiw-data-table"><thead><tr><th>订单</th><th>创建时间</th><th>内容</th><th>状态</th></tr></thead><tbody><tr><td>TB202610230001</td><td>2026/10/23</td><td>专业版月度会员</td><td><span className="aiw-status">示例订单</span></td></tr><tr><td>TB202609230001</td><td>2026/09/23</td><td>专业版月度会员</td><td><span className="aiw-status">示例订单</span></td></tr></tbody></table></div>;
  return <><section className="aiw-membership"><div className="aiw-membership-top"><div><span className="aiw-eyebrow">当前计划</span><h2>专业版 <span className="aiw-demo-badge">示例</span></h2><p>给每天的思考与创造，多一点空间。</p></div><button className="aiw-button" onClick={onPlans}>查看会员权益<ArrowUpRight size={15}/></button></div><div className="aiw-usage-meter"><div><span>本周剩余用量</span><strong>85<span>%</span></strong></div><span>4 天 6 小时后重置</span></div><div className="aiw-meter-track" role="meter" aria-label="示例剩余用量" aria-valuemin={0} aria-valuemax={100} aria-valuenow={85}><span style={{ width: '85%' }}/></div></section><div className="aiw-section-heading"><h2>当前周期的使用记录</h2><span>10 月 19 日 — 10 月 26 日</span></div><div className="aiw-table-wrap"><table className="aiw-data-table"><thead><tr><th>时间</th><th>模式 / 来源</th><th>用量变化</th><th>相关内容</th></tr></thead><tbody>{[['今天 14:01', '对话 · Auto', '−2.4%', '首页信息架构'], ['今天 09:43', '任务 · Pro', '−1.8%', '本周项目进展'], ['昨天 16:20', '对话 · Auto', '−0.8%', 'AI 工具对比']].map(row => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td><button className="aiw-inline-button" onClick={() => onNavigate?.('chats')}>{row[3]}<ArrowUpRight size={14}/></button></td></tr>)}</tbody></table></div></>;
}
export default function WorkspaceContent({ active = true, page = 'chats', variant = 1, data, setData, initialFilter, navigationKey, onNavigate, onNewChat, onFilterChange }) {
  const [shareItem, setShareItem] = useState(null);
  const [pageUI, setPageUI] = useState({}); const [detail, setDetail] = useState(null); const [create, setCreate] = useState(false); const [plans, setPlans] = useState(false); const [notice, setNotice] = useState('');
  const contentRef = useRef(null);
  const detailTrigger = useRef(null);
  const listScroll = useRef(0);
  const restoreList = useRef(false);
  const [previewRoom, setPreviewRoom] = useState(false);
  useEffect(() => {
    const node = contentRef.current;
    if (!node || variant !== 7) { setPreviewRoom(false); return; }
    const observer = new ResizeObserver(([entry]) => setPreviewRoom(entry.contentRect.width >= 850));
    observer.observe(node);
    return () => observer.disconnect();
  }, [variant]);
  const inlinePreview = variant === 7 && previewRoom && !['usage', 'skills'].includes(page);
  const module = MODULES.find(item => item.id === page) || MODULES[0];
  const ui = { ...DEFAULT_UI, view: page === 'tasks' ? 'list' : 'grid', filter: page === 'usage' ? 'membership' : 'all', ...pageUI[page] };
  const setUI = patch => setPageUI(previous => ({ ...previous, [page]: { ...DEFAULT_UI, view: page === 'tasks' ? 'list' : 'grid', ...previous[page], ...patch } }));
  const items = useMemo(() => page === 'skills' ? getSkillCatalogue(data.skills) : getWorkspaceItems(data, page), [data, page]);
  useEffect(() => { if (!active) { setDetail(null); setCreate(false); setPlans(false); setShareItem(null); } }, [active]);
  useEffect(() => {
    setDetail(null); setCreate(false); setPlans(false); setShareItem(null); setNotice('');
    listScroll.current = 0; detailTrigger.current = null;
    if (!initialFilter) return;
    if (initialFilter === 'create' || initialFilter.startsWith('create:')) { setCreate(initialFilter.split(':')[1] || true); return; }
    const found = items.find(item => initialFilter === `detail:${item.id}` || initialFilter === item.title);
    if (found) { setDetail(found.id); if (page === 'notifications' && found.unread) setData(previous => ({ ...previous, notifications: previous.notifications.map(item => item.id === found.id ? { ...item, unread: false } : item) })); return; }
    const tab = (PAGE_TABS[page] || []).find(([value, label]) => value === initialFilter || label === initialFilter);
    if (tab) setPageUI(previous => ({ ...previous, [page]: { ...DEFAULT_UI, view: page === 'tasks' ? 'list' : 'grid', ...previous[page], filter: tab[0], ...(page === 'skills' ? { skillScope: ['installed', 'custom'].includes(tab[0]) ? 'mine' : 'discover', skillMine: tab[0] === 'custom' ? 'custom' : 'installed' } : {}) } }));
  }, [page, initialFilter, navigationKey]);
  useEffect(() => { onFilterChange?.(ui.filter); }, [ui.filter, page, onFilterChange]);
  const filtered = useMemo(() => filterWorkspaceItems(items, ui), [items, ui.query, ui.filter, ui.kind, ui.sort]);
  const selected = items.find(item => item.id === detail);
  const skillDetail = active && page === 'skills' && selected;
  useLayoutEffect(() => {
    const host = contentRef.current?.closest('.aiw-page-host');
    if (skillDetail && host) host.scrollTop = 0;
    else if (restoreList.current && host && page === 'skills') host.scrollTop = listScroll.current;
    restoreList.current = false;
  }, [skillDetail?.id, page]);
  function updateItem(item) { setData(previous => page === 'files' ? updateWorkspaceOutput(previous, item) : { ...previous, [page]: page === 'skills' ? saveSkill(previous.skills, item) : previous[page].map(existing => existing.id === item.id ? item : existing) }); }
  function openDetail(item) { if (page === 'chats') { onNavigate('chats', `detail:${item.id}`); return; } detailTrigger.current = document.activeElement; listScroll.current = contentRef.current?.closest('.aiw-page-host')?.scrollTop || 0; setDetail(item.id); if (page === 'notifications' && item.unread) updateItem({ ...item, unread: false }); }
  function closeDetail() {
    restoreList.current = true;
    setDetail(null);
    requestAnimationFrame(() => {
      const trigger = detailTrigger.current;
      if (trigger?.isConnected && trigger.getClientRects().length && !trigger.closest('[inert]')) trigger.focus?.({ preventScroll: true });
      else if (page === 'skills') contentRef.current?.querySelector('.aiws-header button')?.focus({ preventScroll: true });
    });
  }
  function refreshOutputs() {
    try {
      const refreshed = refreshWorkspaceOutputs(data, localStorage.getItem('personalized-home-2-0-ai-workspace-demo-v1'));
      setData(previous => ({ ...previous, files: refreshed.files, assets: refreshed.assets }));
      setNotice('已刷新本地输出物');
    } catch { setNotice('暂时无法读取本地记录，当前内容已保留。'); }
  }
  function primaryAction() {
    if (page === 'chats') { onNewChat?.(); return; }
    if (page === 'usage') { setPlans(true); return; }
    if (page === 'notifications') { setData(previous => ({ ...previous, notifications: previous.notifications.map(item => ({ ...item, unread: false })) })); setNotice('所有通知已标为已读'); return; }
    setCreate(page === 'files' && ui.filter !== 'all' ? ui.filter : true);
  }
  function saveCreated(form) {
    const collection = page === 'files' ? outputCollection(form.type) : page;
    const base = { id: id(collection), title: form.name, description: form.description, type: form.type, date: '刚刚', createdAt: Date.now() };
    if (collection === 'files') Object.assign(base, { format: form.file?.name.split('.').pop()?.toUpperCase() || TYPE_LABELS[form.type], size: form.file ? `${Math.max(1, Math.round(form.file.size / 1024))} KB` : '本地示例', source: '本机添加' });
    if (page === 'skills') Object.assign(base, { type: 'custom', skillType: form.type, prompt: form.description, tag: '自定义', used: '我创建的' });
    if (page === 'tasks') Object.assign(base, { type: 'active', schedule: `${form.type === 'weekly' ? '每周五' : '每天'} ${form.time}`, lastRun: '尚未运行', date: `下一次 ${form.time}` });
    if (page === 'bookmarks') Object.assign(base, { url: form.url, domain: new URL(form.url).hostname });
    if (page === 'shares') Object.assign(base, { enabled: true, views: 0 });
    setData(previous => ({ ...previous, [collection]: [base, ...previous[collection]] })); setCreate(false); setUI({ filter: page === 'files' ? form.type : 'all', query: '', kind: 'all', ...(page === 'skills' ? { skillScope: 'mine', skillMine: 'custom' } : {}) }); setNotice(`已添加「${form.name}」`);
  }
  const grid = GRID_PAGES.has(page) && ui.view === 'grid';
  const countFor = filter => filter === 'all' ? items.length : filter === 'pinned' ? items.filter(item => item.pinned).length : items.filter(item => filter === 'installed' ? item.type === 'installed' || item.installed : item.type === filter).length;
  return <section ref={contentRef} className={`aiw-content aiw-content-${page} aiw-content-variant-${variant} ${inlinePreview ? 'has-inspector' : ''}`} aria-label={`${module.label}内容`}>
    {skillDetail && <WorkspaceSkillDetail key={selected.id} item={selected} backLabel={ui.skillScope === 'mine' ? '返回我的妙招' : '返回发现妙招'} onBack={closeDetail} onUpdate={updateItem} onUse={onNewChat}/>}
    <div className="aiw-content-primary" hidden={Boolean(skillDetail)} inert={Boolean(skillDetail)}>
    {page === 'skills' ? null : page === 'files' ? <WorkspaceFilesHeader ui={ui} setUI={setUI} onCreate={primaryAction} onRefresh={refreshOutputs}/> : <WorkspacePageHeader key={page} page={page} title={module.label} action={module.action} onAction={primaryAction} tabs={PAGE_TABS[page] || []} ui={ui} setUI={setUI} searchable={page !== 'usage'} hasViews={page !== 'tasks' && GRID_PAGES.has(page)} counts={page === 'tasks' ? Object.fromEntries(PAGE_TABS.tasks.map(([value]) => [value, countFor(value)])) : undefined}
      secondaryActions={<>{page === 'assets' && <button className="aiwp-secondary" onClick={() => setCreate('card')}>上传 AI 卡片</button>}</>}
      filters={page === 'skills' && <select className="aiwp-kind-filter" aria-label="妙招类型" value={ui.kind} onChange={event => setUI({ kind: event.target.value })}><option value="all">所有类型</option><option value="prompt">提示词</option><option value="script">网页脚本</option><option value="task">任务</option></select>}
    />}
    {notice && <p className="aiw-inline-feedback" role="status"><Check size={14}/>{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}><X size={13}/></button></p>}
    <div className="aiw-content-browser"><div className="aiw-content-results" id={page === 'files' ? undefined : `aiw-${page}-results`} role={['files','skills'].includes(page) ? undefined : 'tabpanel'} aria-labelledby={['files','skills'].includes(page) ? undefined : `aiw-${page}-tab-${ui.filter}`}>
    {page === 'skills' ? <WorkspaceSkills active={active && !skillDetail} items={items} ui={ui} setUI={setUI} onCreate={primaryAction} onOpen={openDetail} onUpdate={updateItem} onUse={onNewChat}/> : page === 'files' ? <WorkspaceFiles items={filtered} ui={ui} setUI={setUI} onOpen={openDetail} onCreate={primaryAction} selectedId={inlinePreview ? detail : null} chats={data.chats} onNavigate={onNavigate} onNotice={setNotice} onShare={setShareItem}/> : page === 'tasks' ? <WorkspaceTasks items={filtered} view={ui.view} query={ui.query} onOpen={openDetail} onUpdate={updateItem} onCreate={primaryAction}/> : page === 'usage' ? <UsagePanel filter={ui.filter} onNavigate={onNavigate} onPlans={() => setPlans(true)}/> : <>
      {ui.query && <p className="aiw-results-label" role="status">找到 {filtered.length} 项相关内容</p>}
      {!filtered.length ? <EmptyState icon={ICONS[page]} title={ui.query ? '没有找到相关内容' : '这里还没有内容'} description={ui.query ? '换个关键词，或者切换分类试试。' : '从添加第一项内容开始。'} action={!ui.query && !['notifications'].includes(page) ? module.action : null} onAction={primaryAction}/> : <div className={`aiw-content-items ${grid ? 'aiw-content-grid' : 'aiw-content-list'}`}>
        {filtered.map(item => {
          const Icon = page === 'files' ? FILE_ICONS[item.type] || File : page === 'assets' ? ({ home: House, board: LayoutDashboard, card: Sparkles })[item.type] : page === 'chats' ? item.type === 'cloud' ? Cloud : Monitor : page === 'skills' ? item.skillType === 'script' ? Code2 : item.skillType === 'task' ? CalendarClock : Lightbulb : ICONS[page];
          return <article key={item.id} className={`aiw-content-item ${inlinePreview && detail === item.id ? 'is-previewed' : ''} ${page === 'notifications' && item.unread ? 'is-unread' : ''}`}>
            {grid && page === 'files' && <button className={`aiw-file-preview aiw-file-preview-${item.type}`} aria-label={`预览 ${item.title}`} onClick={() => openDetail(item)}>{item.image ? <img src={item.image} alt=""/> : item.type === 'doc' ? <div className="aiw-document-preview"><span>{item.format}</span><strong>{item.title}</strong><p>{item.description}</p><div/><div/><div/></div> : item.type === 'table' ? <div className="aiw-sheet-preview"><span>项目进展</span><div><b>事项</b><b>状态</b><b>负责人</b><span>体验优化</span><span>进行中</span><span>设计组</span><span>原型验证</span><span>已完成</span><span>产品组</span></div></div> : <><Icon size={36} strokeWidth={1.3}/><span>{item.format}</span></>}</button>}
            {grid && page === 'assets' && <button className={`aiw-asset-preview aiw-asset-preview-${item.type}`} aria-label={`查看 ${item.title}`} onClick={() => openDetail(item)}>{item.image ? <img src={item.image} alt=""/> : <><Icon size={34} strokeWidth={1.3}/><span>{item.type === 'board' ? '内容在一起，思路更清晰。' : item.title === '国际时钟' ? '上海 09:41 · 东京 10:41' : '今天，有什么好想法？'}</span></>}</button>}
            <div className="aiw-item-main">{(!grid || page === 'skills') && <IconBadge icon={Icon} tone={page === 'skills' ? `aiw-tone-${item.skillType}` : ''}/>}<div className="aiw-item-copy"><div className="aiw-item-title-line"><button className="aiw-item-title" onClick={() => openDetail(item)}>{item.title}</button>{item.pinned && <Pin size={12}/ >}{page === 'notifications' && item.unread && <span className="aiw-unread-dot" aria-label="未读"/>}</div><p>{item.description}</p>{page === 'chats' && <span className="aiw-item-tag">{item.tag}</span>}</div>{!grid && item.date && item.date !== '已暂停' && <span className="aiw-item-date">{item.date}</span>}</div>
            <div className="aiw-item-footer"><span>{page === 'files' ? `${item.format} · ${item.size}` : page === 'skills' ? <><span className="aiw-type-label">{TYPE_LABELS[item.skillType]}</span>{TYPE_LABELS[item.type]}</> : page === 'tasks' ? <><span className={`aiw-status ${item.type === 'paused' ? 'is-paused' : ''}`}>{TYPE_LABELS[item.type]}</span>{item.schedule}</> : page === 'shares' ? <>{TYPE_LABELS[item.type]} · {item.views} 次浏览 <span className={`aiw-status ${item.enabled ? '' : 'is-paused'}`}>{item.enabled ? '已启用' : '已停用'}</span></> : page === 'bookmarks' ? item.domain : page === 'notifications' ? TYPE_LABELS[item.type] : page === 'assets' ? [TYPE_LABELS[item.type], item.tag !== TYPE_LABELS[item.type] && (item.tag || '刚刚添加')].filter(Boolean).join(' · ') : TYPE_LABELS[item.type]}</span>
              {page === 'tasks' ? <button className="aiw-inline-button" onClick={() => updateItem({ ...item, type: item.type === 'active' ? 'paused' : 'active' })}>{item.type === 'active' ? <Pause size={14}/> : <Play size={14}/>}{item.type === 'active' ? '暂停' : '恢复'}</button> : page === 'shares' ? <button className="aiw-inline-button" onClick={() => updateItem({ ...item, enabled: !item.enabled })}>{item.enabled ? '停用链接' : '启用链接'}</button> : page === 'chats' ? <button className="aiw-content-icon-button" aria-label={`${item.pinned ? '取消置顶' : '置顶'} ${item.title}`} onClick={() => updateItem({ ...item, pinned: !item.pinned })}><Pin size={14} fill={item.pinned ? 'currentColor' : 'none'}/></button> : page === 'notifications' ? <button className="aiw-inline-button" onClick={() => openDetail(item)}>查看详情<ArrowRight size={14}/></button> : grid ? <button className="aiw-content-icon-button" aria-label={`打开 ${item.title}`} onClick={() => openDetail(item)}><ArrowUpRight size={15}/></button> : null}
            </div>
          </article>;
        })}
      </div>}
    </>}
    </div>
    {selected && page !== 'skills' && <Detail key={selected.id} inline={inlinePreview} page={selected._outputSource?.collection || page} item={selected} onClose={closeDetail} onNavigate={onNavigate} onNewChat={onNewChat} onUpdate={updateItem}/>}
    {inlinePreview && !selected && <aside className="aiw-inspector aiw-inspector-empty" aria-label="内容预览"><FileText size={28} strokeWidth={1.3}/><h2>在这里预览</h2><p>选择一项内容，详情会在这里展开。<br/>列表保持可见，方便继续浏览。</p></aside>}
    </div>
    </div>
    {shareItem && <ShareOutput item={shareItem} onClose={() => setShareItem(null)}/>}
    {create && <CreateForm page={page} defaultType={typeof create === 'string' ? create : undefined} onClose={() => setCreate(false)} onSave={saveCreated}/>}
    {plans && <Modal title="会员计划" onClose={() => setPlans(false)}><div className="aiw-detail-body"><p className="aiw-form-note">用于比较框架的权益示例，不会产生订单或扣费。</p><div className="aiw-plan-options">{[['标准版', '日常提问与轻量探索'], ['专业版', '更多用量，支持深度工作'], ['进阶版', '高频协作与复杂任务']].map(([title, text]) => <article key={title}><CreditCard size={18}/><h3>{title}</h3><p>{text}</p>{title === '专业版' && <span className="aiw-status">当前示例计划</span>}</article>)}</div></div></Modal>}
  </section>;
}
