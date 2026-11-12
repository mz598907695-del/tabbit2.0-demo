import { ConfirmDialog } from './StandardDialog';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Cloud, Files, Folder, FolderCog, FolderPlus, Globe, Laptop, Pencil, Plus, Search, Table2, Trash2, X } from "./icons";
import './task-mount-menus.css';

export const TASK_PLUGINS = [
  { id: 'webpage', name: '网页阅读' },
  { id: 'documents', name: '文档整理' },
  { id: 'sheets', name: '表格分析' },
];
const PLUGIN_ICONS = { webpage: Globe, documents: Files, sheets: Table2 };

function ProjectChoices({ projects, selectedProjectId, onSelectProject, onCreateProject, onRenameProject, onDeleteProject, onCreateFromFolder, onClose }) {
  const inputId = useId();
  const searchRef = useRef(null);
  const nameRef = useRef(null);
  const editRef = useRef(null);
  const listRef = useRef(null);
  const [view, setView] = useState('picker');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [folderPending, setFolderPending] = useState(false);
  const filteredProjects = projects.filter(project => project.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useLayoutEffect(() => {
    (view === 'manage' ? nameRef.current : searchRef.current)?.focus({ preventScroll: true });
  }, [view]);

  useLayoutEffect(() => {
    if (editingId) {
      editRef.current?.focus({ preventScroll: true });
      editRef.current?.select();
    }
  }, [editingId]);


  function showPicker() {
    setView('picker');
    setEditingId(null);
    setDeletingId(null);
    setError('');
  }

  function focusAction(projectId, action) {
    requestAnimationFrame(() => {
      document.getElementById(`${inputId}-${action}-${projectId}`)?.focus({ preventScroll: true });
    });
  }

  function selectProject(projectId) {
    onSelectProject(projectId);
    onClose();
  }

  function createProject(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) return;
    const result = onCreateProject(nextName);
    if (result?.ok === false) {
      setError(result.message || '暂时无法创建项目，请重试。');
      return;
    }
    onClose();
  }

  function renameProject(event, projectId) {
    event.preventDefault();
    if (!editName.trim()) return;
    const result = onRenameProject(projectId, editName.trim());
    if (result?.ok === false) {
      setError(result.message || '暂时无法修改名称，请重试。');
      return;
    }
    setEditingId(null);
    setError('');
    focusAction(projectId, 'rename');
  }

  async function createFromFolder() {
    if (folderPending) return;
    setFolderPending(true);
    setError('');
    try {
      const result = await onCreateFromFolder();
      if (result?.ok) onClose();
      else if (result?.message) setError(result.message);
    } catch {
      setError('暂时无法打开文件夹，请重试。');
    } finally {
      setFolderPending(false);
    }
  }

  function keydown(event) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Escape' && view === 'manage') {
      event.preventDefault();
      event.stopPropagation();
      if (deletingId) {
        focusAction(deletingId, 'delete');
        setDeletingId(null);
      } else if (editingId) {
        focusAction(editingId, 'rename');
        setEditingId(null);
      } else showPicker();
      setError('');
      return;
    }
    if (view !== 'picker' || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const choices = [...(listRef.current?.querySelectorAll('button[data-project-choice]') || [])];
    const index = choices.indexOf(event.target);
    if (event.target !== searchRef.current && index === -1) return;
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    const target = next < 0 ? searchRef.current : choices[Math.min(next, choices.length - 1)];
    target?.focus({ preventScroll: true });
    if (target && listRef.current?.contains(target)) {
      const listBounds = listRef.current.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      if (targetBounds.bottom > listBounds.bottom) listRef.current.scrollTop += targetBounds.bottom - listBounds.bottom;
      else if (targetBounds.top < listBounds.top) listRef.current.scrollTop += targetBounds.top - listBounds.top;
    }
  }

  return <div className="tb-project-picker" onKeyDown={keydown}>
    {view === 'picker' ? <>
      <div className="tb-dropdown-search">
        <Search size={16} aria-hidden="true" />
        <input ref={searchRef} data-composer-initial="" aria-label="搜索项目" placeholder="搜索项目" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
        {query && <button type="button" className="tb-project-icon-button" aria-label="清除项目搜索" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} aria-hidden="true" /></button>}
      </div>
      <div className="tb-project-recents">
        <div className="tb-dropdown-heading"><span>最近项目</span>{selectedProjectId && <button type="button" className="tb-project-text-button" onClick={() => selectProject(null)}>取消选择</button>}</div>
        <div ref={listRef} className="tb-mount-project-options" role="group" aria-label="最近项目">
          {filteredProjects.map(project => <button key={project.id} type="button" className="tb-composer-menu-row tb-project-choice" data-project-choice="" aria-pressed={selectedProjectId === project.id} onClick={() => selectProject(project.id)}>
            <Folder size={16} aria-hidden="true" /><span title={project.name}>{project.name}</span>{selectedProjectId === project.id && <Check size={16} aria-hidden="true" />}
          </button>)}
          {!filteredProjects.length && <p className="tb-dropdown-empty">{query.trim() ? '没有找到匹配的项目' : '暂无最近项目'}</p>}
        </div>
      </div>
      <div className="tb-project-actions tb-dropdown-footer">
        <button type="button" className="tb-composer-menu-row" onClick={() => { setView('manage'); setError(''); }}><FolderCog size={16} aria-hidden="true" /><span>创建或管理项目</span></button>
        <button type="button" className="tb-composer-menu-row" onClick={createFromFolder} disabled={folderPending}><FolderPlus size={16} aria-hidden="true" /><span>{folderPending ? '正在选择文件夹…' : '通过本地文件夹创建项目'}</span></button>
      </div>
    </> : <>
      <header className="tb-project-manage-header">
        <button type="button" className="tb-project-icon-button" aria-label="返回项目列表" onClick={showPicker}><ArrowLeft size={16} aria-hidden="true" /></button>
        <h3>创建或管理项目</h3>
      </header>
      <form className="tb-mount-project-form" onSubmit={createProject}>
        <label htmlFor={inputId}>新项目</label>
        <div className="tb-mount-project-create">
          <input ref={nameRef} id={inputId} value={name} maxLength={64} autoComplete="off" placeholder="输入项目名称" aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={event => { setName(event.target.value); setError(''); }} />
          <button type="submit" className="tb-mount-project-add" aria-label="创建并选择项目" title="创建并选择项目" disabled={!name.trim()}><Plus size={16} aria-hidden="true" /></button>
        </div>
      </form>
      <section className="tb-project-manage-list" aria-label="管理项目">
        <div className="tb-dropdown-heading"><span>全部项目</span><span className="tb-project-count">{projects.length}</span></div>
        {!projects.length && <p className="tb-dropdown-empty">创建项目，开始整理你的任务</p>}
        {projects.map(project => <div className="tb-project-manage-item" key={project.id}>
          {editingId === project.id ? <form className="tb-project-rename-row" onSubmit={event => renameProject(event, project.id)}>
            <input ref={editRef} aria-label={`修改项目名称：${project.name}`} value={editName} maxLength={64} onChange={event => { setEditName(event.target.value); setError(''); }} />
            <button className="tb-project-icon-button" type="submit" aria-label="保存项目名称" disabled={!editName.trim()}><Check size={16} aria-hidden="true" /></button>
            <button className="tb-project-icon-button" type="button" aria-label="取消修改项目名称" onClick={() => { setEditingId(null); setError(''); focusAction(project.id, 'rename'); }}><X size={16} aria-hidden="true" /></button>
          </form> : <div className="tb-project-manage-row">
            <Folder size={16} aria-hidden="true" />
            <span className="tb-project-name" title={project.name}>{project.name}</span>
            {selectedProjectId === project.id && <span className="tb-project-current">当前</span>}
            <button id={`${inputId}-rename-${project.id}`} type="button" className="tb-project-icon-button" aria-label={`重命名项目：${project.name}`} title="重命名" onClick={() => { setEditingId(project.id); setEditName(project.name); setDeletingId(null); setError(''); }}><Pencil size={15} aria-hidden="true" /></button>
            <button id={`${inputId}-delete-${project.id}`} type="button" className="tb-project-icon-button" aria-label={`删除项目：${project.name}`} title="删除" onClick={() => { setDeletingId(project.id); setEditingId(null); setError(''); }}><Trash2 size={15} aria-hidden="true" /></button>
          </div>}
          {deletingId === project.id && <ConfirmDialog title={`删除项目“${project.name}”？`} description="将从任务项目列表中移除此项目。" confirmLabel="删除项目"
            onClose={() => { setDeletingId(null); focusAction(project.id, 'delete'); }}
            onConfirm={() => { onDeleteProject(project.id); setDeletingId(null); requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true })); }}/>}
        </div>)}
      </section>
    </>}
    {error && <p id={`${inputId}-error`} className="tb-composer-error tb-project-error" role="alert">{error}</p>}
  </div>;
}

export default function TaskMountMenus({ kind, anchor, id, Popover, onClose, projects = [], onCreateProject, onRenameProject, onDeleteProject, onCreateFromFolder, selectedProjectId, onSelectProject, pluginIds = [], onTogglePlugin, runLocation, onRunLocationChange }) {
  if (!['project', 'plugins', 'runtime'].includes(kind)) return null;

  const labels = { project: '选择项目', plugins: '挂载插件', runtime: '选择运行位置' };
  return <Popover key={kind} anchor={anchor} kind={kind} id={id} label={labels[kind]} width={kind === 'runtime' ? 336 : kind === 'project' ? 304 : 292} maxHeight={kind === 'project' ? 440 : 300} onClose={onClose}>
    {kind === 'project' && <ProjectChoices projects={projects} selectedProjectId={selectedProjectId} onSelectProject={onSelectProject} onCreateProject={onCreateProject} onRenameProject={onRenameProject} onDeleteProject={onDeleteProject} onCreateFromFolder={onCreateFromFolder} onClose={onClose} />}
    {kind === 'plugins' && <>
      <div className="tb-composer-menu-heading">挂载插件</div>
      {TASK_PLUGINS.map(({ id: pluginId, name }) => { const Icon = PLUGIN_ICONS[pluginId]; return <button key={pluginId} type="button" className="tb-composer-menu-row" role="menuitemcheckbox" aria-checked={pluginIds.includes(pluginId)} data-composer-menu-item onClick={() => onTogglePlugin(pluginId)}>
        <Icon size={16} aria-hidden="true" /><span>{name}</span>{pluginIds.includes(pluginId) && <Check size={16} aria-hidden="true" />}
      </button>; })}
    </>}
    {kind === 'runtime' && <>
      <div className="tb-composer-menu-heading">此任务在哪里运行？</div>
      {[
        { value: 'local', name: '在你的计算机上', description: '此任务仅保留在这台电脑上', Icon: Laptop },
        { value: 'cloud', name: '在云端', description: '可在任意设备上使用，并能访问你的电脑', Icon: Cloud },
      ].map(({ value, name, description, Icon }) => <button key={value} type="button" className="tb-composer-menu-row tb-mount-runtime-choice" role="menuitemradio" aria-checked={runLocation === value} data-composer-menu-item onClick={() => { onRunLocationChange(value); onClose(); }}>
        <Icon size={16} aria-hidden="true" /><span className="tb-mount-runtime-copy"><strong>{name}</strong><small>{description}</small></span>{runLocation === value && <Check className="tb-mount-choice-check" size={16} strokeWidth={2.5} aria-hidden="true" />}
      </button>)}
    </>}
  </Popover>;
}
