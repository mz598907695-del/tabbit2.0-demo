import { getHomeRoot } from "./home-host";
/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Lightbulb, Pencil, Plus, Trash2, X } from "./icons";
import './composer-ideas-manager.css';

export default function ComposerIdeasManager({ customCommands, onSave, onDelete, onClose, returnFocus, owner, initialCreate = false }) {
  const id = useId();
  const dialogRef = useRef(null);
  const createRef = useRef(null);
  const closeRef = useRef(null);
  const nameRef = useRef(null);
  const cancelDeleteRef = useRef(null);
  const itemRefs = useRef(new Map());
  const backdropRef = useRef(false);
  const composingRef = useRef(false);
  const restoreItemRef = useRef(null);
  const createdNameRef = useRef(null);
  const [editor, setEditor] = useState(() => initialCreate ? { id: null } : null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
      });
    };
  }, []);

  useLayoutEffect(() => {
    if (editor) {
      nameRef.current?.focus({ preventScroll: true });
      if (editor.id) nameRef.current?.select();
    } else if (deleteId) {
      cancelDeleteRef.current?.focus({ preventScroll: true });
    } else {
      const createdId = createdNameRef.current
        ? customCommands.find(command => command.name === createdNameRef.current)?.id
        : null;
      const target = itemRefs.current.get(createdId || restoreItemRef.current)
        || (!createRef.current?.disabled && createRef.current)
        || itemRefs.current.values().next().value
        || closeRef.current;
      target?.focus({ preventScroll: true });
      restoreItemRef.current = null;
      createdNameRef.current = null;
    }
  }, [editor, deleteId]);

  function beginEdit(command) {
    restoreItemRef.current = command?.id || null;
    setName(command?.name || '');
    setPrompt(command?.prompt || '');
    setError('');
    setDeleteId(null);
    setEditor({ id: command?.id || null });
  }

  function returnToList() {
    setEditor(null);
    setDeleteId(null);
    setError('');
  }

  function dismissLayer() {
    if (editor || deleteId) returnToList();
    else onClose();
  }

  function save(event) {
    event.preventDefault();
    if (composingRef.current) return;
    const nextName = name.trim();
    const nextPrompt = prompt.trim();
    if (!nextName || !nextPrompt) {
      setError('请填写妙招名称和提示词。');
      if (!nextName) nameRef.current?.focus();
      return;
    }
    if (nextName.length > 40 || nextPrompt.length > 4000) {
      setError('名称最多 40 个字符，提示词最多 4000 个字符。');
      return;
    }
    const result = onSave(nextName, nextPrompt, editor.id);
    if (result?.ok === false) {
      setError(result.message || '暂时无法保存，请重试。');
      return;
    }
    if (!editor.id) createdNameRef.current = nextName;
    setAnnouncement(`已保存妙招「${nextName}」`);
    returnToList();
  }

  function remove(command) {
    const result = onDelete(command.id);
    if (result?.ok === false) {
      setError(result.message || '暂时无法删除，请重试。');
      return;
    }
    const index = customCommands.findIndex(entry => entry.id === command.id);
    restoreItemRef.current = customCommands[index + 1]?.id || customCommands[index - 1]?.id || null;
    setAnnouncement(`已删除妙招「${command.name}」`);
    returnToList();
  }

  function outside(event) {
    if (event.target !== dialogRef.current) return false;
    const bounds = dialogRef.current.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }

  return createPortal(<dialog
    ref={dialogRef}
    className="tb-command-dialog tb-ideas-manager"
    data-composer-owner={owner}
    aria-labelledby={`${id}-title`}
    onCancel={event => { event.preventDefault(); event.stopPropagation(); dismissLayer(); }}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        if (event.key === 'Enter') event.preventDefault();
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); dismissLayer(); }
    }}
    onPointerDown={event => { backdropRef.current = outside(event); }}
    onPointerCancel={() => { backdropRef.current = false; }}
    onClick={event => {
      if (backdropRef.current && outside(event)) dismissLayer();
      backdropRef.current = false;
    }}
  >
    <header>
      <div className="tb-ideas-manager-title">
        {editor && <button type="button" className="tb-composer-icon" aria-label="返回妙招管理" onClick={returnToList}><ArrowLeft size={17} aria-hidden="true" /></button>}
        <h2 id={`${id}-title`}>{editor ? editor.id ? '编辑妙招' : '新建妙招' : '管理妙招'}</h2>
      </div>
      <button ref={closeRef} type="button" className="tb-composer-icon" aria-label="关闭妙招管理" onClick={onClose}><X size={18} aria-hidden="true" /></button>
    </header>
    {editor ? <form onSubmit={save} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }}>
      <div className="tb-command-fields">
        <label htmlFor={`${id}-name`}>名称</label>
        <input ref={nameRef} id={`${id}-name`} value={name} onChange={event => { setName(event.target.value); setError(''); }} maxLength={40} placeholder="例如：整理阅读笔记" autoComplete="off" />
        <label htmlFor={`${id}-prompt`}>提示词</label>
        <textarea id={`${id}-prompt`} value={prompt} onChange={event => { setPrompt(event.target.value); setError(''); }} maxLength={4000} rows={6} placeholder="描述你希望完成的任务，以及输出格式或要求…" />
        <p className="tb-ideas-manager-hint">使用妙招时将填入提示词，不会自动发送。</p>
        {error && <p className="tb-composer-error" role="alert">{error}</p>}
      </div>
      <footer>
        <button type="button" className="tb-composer-secondary" onClick={returnToList}>取消</button>
        <button type="submit" className="tb-composer-primary" disabled={!name.trim() || !prompt.trim()}>保存妙招</button>
      </footer>
    </form> : <>
      <div className="tb-ideas-manager-body">
        <button ref={createRef} type="button" className="tb-ideas-manager-create" onClick={() => beginEdit(null)} disabled={customCommands.length >= 30}>
          <Plus size={18} aria-hidden="true" /><span>{customCommands.length >= 30 ? '已达到 30 个自定义妙招上限' : '新建妙招'}</span>
        </button>
        {customCommands.length ? <ul className="tb-ideas-manager-list" aria-label="自定义妙招">
          {customCommands.map(command => <li key={command.id}>
            <div className="tb-ideas-manager-item">
              <span className="tb-ideas-manager-symbol"><Lightbulb size={18} aria-hidden="true" /></span>
              <div className="tb-ideas-manager-copy"><strong>{command.name}</strong><p>{command.prompt}</p></div>
              <div className="tb-ideas-manager-actions">
                <button ref={node => { if (node) itemRefs.current.set(command.id, node); else itemRefs.current.delete(command.id); }} type="button" className="tb-composer-icon" aria-label={`编辑妙招：${command.name}`} title="编辑" onClick={() => beginEdit(command)}><Pencil size={16} aria-hidden="true" /></button>
                <button type="button" className="tb-composer-icon" aria-label={`删除妙招：${command.name}`} title="删除" onClick={() => { restoreItemRef.current = command.id; setDeleteId(command.id); setError(''); }}><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </div>
            {deleteId === command.id && <div className="tb-ideas-manager-delete" role="group" aria-label={`确认删除妙招：${command.name}`}>
              <p>删除「{command.name}」？</p>
              {error && <p className="tb-composer-error" role="alert">{error}</p>}
              <div>
                <button ref={cancelDeleteRef} type="button" className="tb-composer-secondary" onClick={returnToList}>取消</button>
                <button type="button" className="tb-composer-secondary tb-ideas-manager-danger" onClick={() => remove(command)}>删除</button>
              </div>
            </div>}
          </li>)}
        </ul> : <div className="tb-ideas-manager-empty">
          <Lightbulb size={25} aria-hidden="true" />
          <strong>还没有自定义妙招</strong>
          <p>保存常用提示词，下次直接使用。</p>
        </div>}
      </div>
      <footer className="tb-ideas-manager-footer"><p>自定义妙招保存在当前浏览器。</p></footer>
    </>}
    <span className="tb-ideas-manager-announcement" role="status" aria-live="polite">{announcement}</span>
  </dialog>, getHomeRoot());
}
