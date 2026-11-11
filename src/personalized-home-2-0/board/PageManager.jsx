import { useEffect, useId, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getHomeRoot } from '../home-host';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "../icons";
import { BoardConfirm } from './BoardDialogs';
import { reorderPages } from './state';
import PageOverviewThumbnail from './PageOverviewThumbnail';
import './page-manager.css';

export default function PageManager({ ref, pages, activePageId, onReorder, onRename, onDelete, onAdd, onSelect, onBusyChange }) {
  const helpId = useId();
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const nameRef = useRef(null);
  const addRef = useRef(null);
  const addNameRef = useRef(null);
  const handleRefs = useRef(new Map());
  const renameRefs = useRef(new Map());
  const deleteRefs = useRef(new Map());
  const dragRef = useRef(null);
  const handlersRef = useRef(null);
  const busyCallbackRef = useRef(onBusyChange);
  const [drag, setDrag] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [adding, setAdding] = useState(false);
  const [addName, setAddName] = useState('');
  const [addError, setAddError] = useState('');
  busyCallbackRef.current = onBusyChange;
  const busy = Boolean(drag?.moved || renaming || deleting || adding);
  const shownPages = drag?.moved ? reorderPages(pages, drag.id, drag.targetIndex) : pages;
  const draggedPage = drag?.moved ? pages.find(entry => entry.id === drag.id) : null;
  const deletingPage = pages.find(entry => entry.id === deleting);

  useImperativeHandle(ref, () => ({ cancelTransient }));
  useLayoutEffect(() => { if (adding) addNameRef.current?.focus({ preventScroll: true }); }, [adding]);
  useEffect(() => { busyCallbackRef.current?.(busy); }, [busy]);
  useEffect(() => () => { busyCallbackRef.current?.(false); }, []);
  useLayoutEffect(() => {
    if (!renaming) return;
    nameRef.current?.focus({ preventScroll: true });
    nameRef.current?.select();
  }, [renaming]);
  useEffect(() => {
    if (dragRef.current && dragRef.current.pages !== pages) cancelDrag();
    if (renaming && !pages.some(entry => entry.id === renaming)) setRenaming(null);
    if (deleting && (!pages.some(entry => entry.id === deleting) || pages.length < 2)) setDeleting(null);
  }, [pages, renaming, deleting]);

  function releaseCapture(current) {
    if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  }
  function cancelDrag() {
    const current = dragRef.current;
    dragRef.current = null;
    releaseCapture(current);
    setDrag(null);
  }
  function restoreHandle(id) {
    requestAnimationFrame(() => handleRefs.current.get(id)?.focus({ preventScroll: true }));
  }
  function restoreAction(refs, id) {
    requestAnimationFrame(() => {
      const action = refs.current.get(id);
      const fallback = renameRefs.current.get(id) || addRef.current;
      (action && !action.disabled ? action : fallback)?.focus({ preventScroll: true });
    });
  }
  function startDrag(event, entry) {
    if (event.button !== 0 || event.isPrimary === false || dragRef.current || renaming || deleting || adding || pages.length < 2) return;
    const row = event.currentTarget.closest('[data-page-manager-row]');
    const rect = row.getBoundingClientRect();
    const index = pages.findIndex(item => item.id === entry.id);
    dragRef.current = {
      id: entry.id, pages, startX: event.clientX, startY: event.clientY,
      pointerId: event.pointerId, handle: event.currentTarget,
      grabX: event.clientX - rect.left, grabY: event.clientY - rect.top, width: rect.width, height: rect.height,
      clientX: event.clientX, clientY: event.clientY, targetIndex: index, initialIndex: index, moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function updateTarget(clientX, clientY) {
    const current = dragRef.current;
    if (!current?.moved || !listRef.current) return;
    const centerX = clientX - current.grabX + current.width / 2;
    const centerY = clientY - current.grabY + current.height / 2;
    const targets = [...listRef.current.querySelectorAll('[data-page-manager-row]')];
    let targetIndex = current.targetIndex, nearest = Infinity;
    targets.forEach((node, index) => {
      const bounds = node.getBoundingClientRect();
      const distance = Math.hypot(centerX - bounds.left - bounds.width / 2, centerY - bounds.top - bounds.height / 2);
      if (distance < nearest) { nearest = distance; targetIndex = index; }
    });
    const next = { ...current, targetIndex, clientX, clientY };
    dragRef.current = next;
    setDrag(next);
  }
  function pointerMove(event) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return;
    if (event.cancelable) event.preventDefault();
    current.moved = true;
    updateTarget(event.clientX, event.clientY);
  }
  function finishDrag(event) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (current.moved) updateTarget(event.clientX, event.clientY);
    const finished = dragRef.current;
    cancelDrag();
    if (finished.moved && finished.pages === pages && finished.targetIndex !== finished.initialIndex) {
      onReorder?.(finished.id, finished.targetIndex);
      setAnnouncement(`已移至第 ${finished.targetIndex + 1} 个位置`);
    }
    restoreHandle(finished.id);
  }
  handlersRef.current = { move: pointerMove, finish: finishDrag, cancel: cancelDrag, updateTarget };

  useEffect(() => {
    const move = event => handlersRef.current?.move(event);
    const finish = event => handlersRef.current?.finish(event);
    const cancel = event => {
      if (event.type === 'blur' || event.type === 'resize' || event.pointerId === dragRef.current?.pointerId) handlersRef.current?.cancel();
    };
    const key = event => {
      if (event.key !== 'Escape' || !dragRef.current) return;
      event.preventDefault(); event.stopPropagation();
      const id = dragRef.current.id;
      handlersRef.current?.cancel(); restoreHandle(id);
    };
    document.addEventListener('pointermove', move, { passive: false });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', finish);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      const current = dragRef.current;
      dragRef.current = null; releaseCapture(current);
    };
  }, []);
  useEffect(() => {
    if (!drag?.moved) return;
    let frame;
    let previousTime = 0;
    const step = time => {
      const current = dragRef.current;
      const scroll = scrollRef.current;
      if (!current?.moved || !scroll) return;
      const rect = scroll.getBoundingClientRect();
      const edge = 42;
      const distance = current.clientY < rect.top + edge ? current.clientY - rect.top - edge
        : current.clientY > rect.bottom - edge ? current.clientY - rect.bottom + edge : 0;
      const elapsed = previousTime ? Math.min(32, time - previousTime) : 16;
      previousTime = time;
      const velocity = Math.max(-12, Math.min(12, distance / 3));
      if (velocity) {
        const before = scroll.scrollTop;
        scroll.scrollTop += velocity * elapsed / 16;
        if (before !== scroll.scrollTop) handlersRef.current?.updateTarget(current.clientX, current.clientY);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [Boolean(drag?.moved)]);

  function keyboardReorder(event, entry, index) {
    if (!event.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || renaming || deleting || adding) return;
    event.preventDefault(); event.stopPropagation();
    const rows = [...listRef.current.querySelectorAll('[data-page-manager-row]')];
    const top = rows[0]?.getBoundingClientRect().top;
    const columns = Math.max(1, rows.filter(node => Math.abs(node.getBoundingClientRect().top - top) < 2).length);
    const delta = event.key === 'ArrowUp' ? -columns : event.key === 'ArrowDown' ? columns : event.key === 'ArrowLeft' ? -1 : 1;
    const target = Math.max(0, Math.min(pages.length - 1, index + delta));
    if (target === index) return;
    onReorder?.(entry.id, target);
    setAnnouncement(`已将${entry.name}移至第 ${target + 1} 个位置`);
    restoreHandle(entry.id);
  }
  function startRename(entry) {
    cancelDrag(); setAdding(false); setDeleting(null); setName(entry.name); setRenaming(entry.id);
  }
  function cancelRename() {
    const id = renaming;
    setRenaming(null); restoreAction(renameRefs, id);
  }
  function saveName(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    const id = renaming;
    onRename?.(id, nextName);
    setRenaming(null); restoreAction(renameRefs, id);
  }
  function cancelDelete() {
    const id = deleting;
    setDeleting(null); restoreAction(deleteRefs, id);
  }
  function confirmDelete() {
    if (!deletingPage || pages.length < 2) return;
    const index = pages.findIndex(entry => entry.id === deletingPage.id);
    const next = pages[index + 1] || pages[index - 1];
    onDelete?.(deletingPage.id);
    setAnnouncement(`已删除看板：${deletingPage.name}`);
    setDeleting(null); restoreAction(deleteRefs, next?.id);
  }

  function cancelAdd() {
    setAdding(false); setAddError('');
    requestAnimationFrame(() => addRef.current?.focus({ preventScroll: true }));
  }
  function cancelTransient() {
    if (dragRef.current) { const id = dragRef.current.id; cancelDrag(); restoreHandle(id); return true; }
    if (adding) { cancelAdd(); return true; }
    if (renaming) { cancelRename(); return true; }
    if (deleting) { cancelDelete(); return true; }
    return false;
  }
  function addPage(event) {
    event.preventDefault();
    const nextName = addName.trim();
    if (!nextName) { addNameRef.current?.focus(); return; }
    if (pages.length >= 20) { setAddError('最多可添加 20 个看板'); return; }
    const result = onAdd?.(nextName);
    if (result === false || result?.ok === false) { setAddError(result?.message || '添加失败，请重试'); return; }
    setAnnouncement(`已添加看板：${nextName}`);
    setAddName(''); cancelAdd();
  }

  return <div ref={scrollRef} className="page-manager" onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key !== 'Escape') return;
    if (cancelTransient()) { event.preventDefault(); event.stopPropagation(); }
  }}>
    <span className="page-manager-sr-only" id={`${helpId}-keyboard`}>聚焦拖动按钮后，可按 Alt 加方向键调整顺序；左右移动一项，上下移动一行。</span>
    <ol ref={listRef} className="page-manager-list" aria-label="看板列表">
      {shownPages.map((entry, index) => <li key={entry.id} data-page-manager-row={entry.id}
        className={`page-manager-row${entry.id === activePageId ? ' is-current' : ''}${drag?.moved && drag.id === entry.id ? ' is-placeholder' : ''}`}>
        <button type="button" className="page-manager-preview" aria-label={`进入看板：${entry.name}`} disabled={Boolean(drag?.moved || adding || renaming || deleting)} onClick={() => onSelect?.(entry.id)}>
          <PageOverviewThumbnail page={entry}/>
          {entry.id === activePageId && <span className="page-overview-current"><Check size={12} aria-hidden="true"/>当前看板</span>}
        </button>
        <form className="page-manager-row-main" onSubmit={event => {
          event.preventDefault();
          if (renaming === entry.id) saveName(event);
        }}>
          <button ref={node => { if (node) handleRefs.current.set(entry.id, node); else handleRefs.current.delete(entry.id); }}
            type="button" className="page-manager-icon page-manager-grip" aria-label={`拖动排序：${entry.name}`}
            aria-describedby={`${helpId}-keyboard`} title="拖动排序 · Alt + 方向键"
            disabled={pages.length < 2 || Boolean(renaming || deleting || adding)} onPointerDown={event => startDrag(event, entry)}
            onKeyDown={event => keyboardReorder(event, entry, index)}><GripVertical size={16} aria-hidden="true" /></button>
          <div className="page-manager-name">
            {renaming === entry.id
              ? <input ref={nameRef} className="page-manager-name-input" aria-label="看板名称" value={name} maxLength={24} autoComplete="off"
                onChange={event => setName(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} />
              : <><span title={entry.name}>{entry.name}</span><small>{entry.items.length} 张卡片</small></>}
          </div>
          <div className="page-manager-actions">
            {renaming === entry.id ? <>
              <button key="save" type="submit" className="page-manager-icon" aria-label="保存看板名称" title="保存" disabled={!name.trim()}><Check size={16} aria-hidden="true" /></button>
              <button key="cancel" type="button" className="page-manager-icon" aria-label="取消重命名" title="取消" onClick={cancelRename}><X size={16} aria-hidden="true" /></button>
            </> : <>
              <button key="rename" ref={node => { if (node) renameRefs.current.set(entry.id, node); else renameRefs.current.delete(entry.id); }}
                type="button" className="page-manager-icon" aria-label={`重命名看板：${entry.name}`} title="重命名" disabled={Boolean(drag?.moved)} onClick={event => { event.preventDefault(); startRename(entry); }}><Pencil size={15} aria-hidden="true" /></button>
              <button key="delete" ref={node => { if (node) deleteRefs.current.set(entry.id, node); else deleteRefs.current.delete(entry.id); }}
                type="button" className="page-manager-icon" aria-label={`删除看板：${entry.name}`} title={pages.length < 2 ? '至少保留一个看板' : '删除'} disabled={pages.length < 2 || Boolean(drag?.moved)} onClick={() => { cancelDrag(); setAdding(false); setRenaming(null); setDeleting(entry.id); }}><Trash2 size={15} aria-hidden="true" /></button>
            </>}
          </div>
        </form>
      </li>)}
      {onAdd && <li className={`page-manager-row page-manager-add-row${adding ? ' is-adding' : ''}`}>
        <button ref={addRef} type="button" className="page-manager-add-trigger" aria-expanded={adding}
          disabled={pages.length >= 20 || Boolean(drag?.moved)}
          title={pages.length >= 20 ? '最多可添加 20 个看板' : undefined}
          onClick={() => { cancelDrag(); setRenaming(null); setDeleting(null); setAddError(''); setAdding(true); }}>
          <span className="page-overview-add-icon"><Plus size={24} aria-hidden="true" /></span><strong>添加看板</strong>
          <small>{pages.length >= 20 ? '最多可添加 20 个看板' : '从一个空白看板开始'}</small>
        </button>
        {adding && <form className="page-manager-add-form" onSubmit={addPage}>
          <div className="page-manager-rename">
            <input ref={addNameRef} aria-label="新看板名称" value={addName} placeholder="输入看板名称" maxLength={24} autoComplete="off"
              aria-invalid={Boolean(addError)} aria-describedby={addError ? `${helpId}-add-error` : undefined}
              onChange={event => { setAddName(event.target.value); setAddError(''); }}
              onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} />
            <button type="submit" className="page-manager-icon" aria-label="确认添加看板" title="添加" disabled={!addName.trim()}><Check size={16} aria-hidden="true" /></button>
            <button type="button" className="page-manager-icon" aria-label="取消添加看板" title="取消" onClick={cancelAdd}><X size={16} aria-hidden="true" /></button>
          </div>
          {addError && <p id={`${helpId}-add-error`} className="page-manager-add-error" role="alert">{addError}</p>}
        </form>}
      </li>}

    </ol>
    {deletingPage && pages.length > 1 && <BoardConfirm
      title={`删除看板“${deletingPage.name}”？`}
      description="此看板中的快捷方式和小组件也会一并删除。"
      confirmLabel="删除看板" className="page-manager-delete-dialog" anchorRef={scrollRef}
      onClose={cancelDelete} onConfirm={confirmDelete}
    />}
    {draggedPage && createPortal(<div className="page-manager-drag-ghost" aria-hidden="true" style={{ left: drag.clientX - drag.grabX, top: drag.clientY - drag.grabY, width: drag.width, height: drag.height }}>
      <PageOverviewThumbnail page={draggedPage}/><span>{draggedPage.name}</span>
    </div>, getHomeRoot())}
    <span className="page-manager-sr-only" role="status" aria-live="polite">{announcement}</span>
  </div>;
}
