import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Folder, FolderPlus, Search, X } from '../../icons';

import { canMoveTo, folderPath, liveNodes, ordered, makeId } from './bookmark-model';

function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null), titleId = useId();
  useLayoutEffect(() => {
    const trigger = document.activeElement, node = ref.current;
    node.showModal();
    (node.querySelector('[data-autofocus]') || node.querySelector('input,button'))?.focus();
    return () => { node.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`bkm-dialog${wide ? ' is-wide' : ''}`} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}
    onClick={event => { if (event.target === ref.current) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="bkm-dialog-heading"><h2 id={titleId}>{title}</h2><button className="bkm-icon" aria-label="关闭弹窗" onClick={onClose}><X size={18}/></button></div>{children}
  </dialog>;
}

export function BookmarkEditDialog({ action, library, onClose, onSubmit }) {
  const [title, setTitle] = useState(action.node?.title || ''), [url, setUrl] = useState(action.node?.url || '');
  const [note, setNote] = useState(action.node?.note || action.node?.description || ''), [excerpt, setExcerpt] = useState(action.node?.excerpt || '');
  const [error, setError] = useState('');
  const folder = action.kind === 'folder' || action.node?.kind === 'folder', grouping = action.type === 'group';
  const heading = grouping ? '放入新文件夹' : action.node ? folder ? '重命名文件夹' : '编辑收藏' : folder ? '新建文件夹' : '添加收藏';
  const path = ['收藏', ...folderPath(library.nodes, action.parentId).map(node => node.title)].join(' / ');
  return <Dialog title={heading} onClose={onClose}><form onSubmit={event => {
    event.preventDefault();
    try { onSubmit({ title, url, note, excerpt, later: action.node?.later }); } catch (err) { setError(err.message); }
  }}>
    {!action.node && <p className="bkm-dialog-caption">{grouping ? `将选中的 ${action.ids.length} 项整理到` : '保存到'}：{path}</p>}
    <label>名称<input data-autofocus value={title} onChange={event => setTitle(event.target.value)} maxLength={240} placeholder={folder ? '文件夹名称' : '收藏标题'} required/></label>
    {!folder && <><label>网址<input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" type="url" required/></label>
      <label>收藏理由 <span>可选</span><textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="为什么值得收藏？下次什么时候用？" maxLength={4000}/></label>
      <label>摘录 <span>可选</span><textarea value={excerpt} onChange={event => setExcerpt(event.target.value)} rows={2} placeholder="留下值得回看的片段" maxLength={12000}/></label>
      </>}
    {error && <p className="bkm-error" role="alert">{error}</p>}
    <div className="bkm-dialog-actions"><button type="button" className="bkm-button" onClick={onClose}>取消</button><button className="bkm-button is-primary" type="submit">{grouping ? '创建并移动' : action.node ? '保存' : '创建'}</button></div>
  </form></Dialog>;
}

export function BookmarkMoveDialog({ action, library, recentFolders, onClose, onMove, onCreate }) {
  const [query, setQuery] = useState(''), [target, setTarget] = useState(action.parentId || library.rootIds.folders), [expanded, setExpanded] = useState(() => new Set(folderPath(library.nodes, action.parentId).map(node => node.id)));
  const [creating, setCreating] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const folders = ordered(liveNodes(library).filter(node => node.kind === 'folder'));
  const allowed = id => canMoveTo(library, action.ids, id);
  const filtered = query.trim() ? folders.filter(node => node.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : null;
  const path = id => ['收藏', ...folderPath(library.nodes, id).map(node => node.title)].join(' / ');
  function item(node, depth = 0) {
    const children = folders.filter(child => child.parentId === node.id);
    return <div key={node.id}><div className={`bkm-picker-row${target === node.id ? ' is-selected' : ''}`} style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <button className="bkm-icon bkm-disclosure" aria-label={`${expanded.has(node.id) ? '收起' : '展开'} ${node.title}`} disabled={!children.length || !!filtered} onClick={() => setExpanded(previous => { const next = new Set(previous); next.has(node.id) ? next.delete(node.id) : next.add(node.id); return next; })}><ChevronRight size={14} style={{ transform: expanded.has(node.id) ? 'rotate(90deg)' : undefined }}/></button>
      <button disabled={!allowed(node.id)} title={!allowed(node.id) ? '不能移入自身或子文件夹' : path(node.id)} className="bkm-picker-target" onClick={() => { setTarget(node.id); setError(''); }}><Folder size={17}/><span>{node.title}{filtered && <small>{path(node.parentId)}</small>}</span>{target === node.id && <Check size={15}/>}</button>
    </div>{!filtered && expanded.has(node.id) && children.map(child => item(child, depth + 1))}</div>;
  }
  return <Dialog title={`移动 ${action.ids.length} 项`} onClose={onClose}><div className="bkm-search bkm-picker-search"><Search size={16}/><input data-autofocus aria-label="搜索目标文件夹" placeholder="搜索文件夹" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button className="bkm-icon" aria-label="清空目录搜索" onClick={() => setQuery('')}><X size={14}/></button>}</div>
    {!query && recentFolders.filter(id => folders.some(node => node.id === id) && allowed(id)).length > 0 && <div className="bkm-recent-targets"><span>最近使用</span>{recentFolders.filter(id => folders.some(node => node.id === id) && allowed(id)).slice(0, 3).map(id => <button key={id} title={path(id)} onClick={() => setTarget(id)}>{folders.find(node => node.id === id).title}</button>)}</div>}
    <div className="bkm-folder-picker" aria-label="目标文件夹">
      {(filtered || folders.filter(node => !node.parentId)).map(node => item(node))}
      {filtered?.length === 0 && <p className="bkm-dialog-caption">没有找到文件夹，可以在下方新建。</p>}
    </div>
    <p className="bkm-destination" title={path(target)}>移动到：{path(target)}</p>
    {creating && <form className="bkm-inline-create" onSubmit={event => { event.preventDefault(); try { const id = makeId(); onCreate({ id, title: name, parentId: target }); setExpanded(previous => new Set([...previous, ...(target ? [target] : [])])); setTarget(id); setCreating(false); setName(''); setError(''); } catch (err) { setError(err.message); } }}>
      <input aria-label="新文件夹名称" placeholder="新文件夹名称" value={name} onChange={event => setName(event.target.value)} autoFocus required maxLength={240}/><button className="bkm-button" type="submit">创建</button><button className="bkm-icon" aria-label="取消新建文件夹" type="button" onClick={() => setCreating(false)}><X size={16}/></button>
    </form>}
    {error && <p role="alert" className="bkm-error">{error}</p>}
    <div className="bkm-dialog-actions bkm-move-actions">{!creating && <button className="bkm-text-button bkm-move-create" aria-label="在此处新建文件夹" title="在此处新建文件夹" disabled={!allowed(target)} onClick={() => setCreating(true)}><FolderPlus size={16}/><span className="bkm-create-label">在此处新建文件夹</span><span className="bkm-create-label-short" aria-hidden="true">新建</span></button>}<button className="bkm-button" onClick={onClose}>取消</button><button className="bkm-button is-primary" disabled={!allowed(target) || creating} onClick={() => { try { onMove(target); } catch (err) { setError(err.message); } }}>移动到这里</button></div>
  </Dialog>;
}

export function BookmarkConfirmDialog({ action, onClose, onConfirm }) {
  const [error, setError] = useState('');
  return <Dialog title={action.title} onClose={onClose}><p className="bkm-confirm-copy">{action.message}</p>
    {action.detail && <p className="bkm-dialog-caption">{action.detail}</p>}
    {error && <p className="bkm-error" role="alert">{error}</p>}
    <div className="bkm-dialog-actions"><button data-autofocus className="bkm-button" onClick={onClose}>取消</button><button className={`bkm-button ${action.danger ? 'is-danger' : 'is-primary'}`} onClick={() => { try { onConfirm(); } catch (err) { setError(err.message); } }}>{action.confirmLabel}</button></div>
  </Dialog>;
}

export function BookmarkTextDialog({ title, value, onClose }) {
  return <Dialog title={title} onClose={onClose}><p className="bkm-dialog-caption">浏览器没有允许自动复制。选中下方内容后按 ⌘/Ctrl+C。</p><textarea data-autofocus className="bkm-copy-fallback" readOnly value={value} onFocus={event => event.target.select()}/><div className="bkm-dialog-actions"><button className="bkm-button" onClick={onClose}>完成</button></div></Dialog>;
}
