import { getHomeRoot } from "./home-host";
/* eslint-disable -- Preserved upstream prototype snapshot; see ../README.md for isolated validation. */
import { cloneElement, forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ChevronDown, Cloud, Folder, Globe, Laptop, Lightbulb, Mic, Paperclip, Plus, Star, X } from "./icons";
import { COMMAND_STORAGE_KEY, DEFAULT_COMMANDS, formatAttachmentSize, isPreviewableImage, partitionAttachments, readCustomCommands } from './composer-data';
import { MIN_REPLY_MODELS, readModelSelection, setReplyModelMode, toggleReplyModel } from './composer-models';
import { promoteProject, validateProjectName } from './composer-projects';
import ComposerModelMenu from './ComposerModelMenu';
import TaskMountMenus from './TaskMountMenus';
import LocalTaskMenus, { APPROVAL_POLICIES } from './LocalTaskMenus';
import ComposerAddMenu from './ComposerAddMenu';
import ComposerIdeasMenu, { IDEAS } from './ComposerIdeasMenu';
import ComposerIdeasManager from './ComposerIdeasManager';
import { useComposerScroll } from './useComposerScroll';
import './composer.css';
import './task-mount.css';
import './composer-scroll.css';

function focusBesideTrigger(trigger, direction) {
  const elements = [...document.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    .filter(node => !node.closest('.tb-composer-popover, [inert]') && node.getClientRects().length);
  const index = elements.indexOf(trigger);
  (elements[index + direction] || trigger)?.focus({ preventScroll: true });
}

// Retain each dropdown for its exit motion while its trigger and cards reset.
function ComposerPopoverPresence({ active, children }) {
  const retained = useRef(null);
  const [present, setPresent] = useState(active);
  if (active) retained.current = children;
  useLayoutEffect(() => {
    if (active) { setPresent(true); return; }
    if (!present) return;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300;
    const timer = window.setTimeout(() => setPresent(false), duration);
    return () => window.clearTimeout(timer);
  }, [active, present]);
  return (active || present) && retained.current
    ? cloneElement(active ? children : retained.current, { closing: !active }) : null;
}

function ComposerPopover({ anchor, kind, id, label, width, maxHeight, onClose, children, closing = false }) {
  const layerRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [geometry, setGeometry] = useState(null);
  const isDialog = ['add', 'project', 'ideas'].includes(kind);

  function position() {
    const layer = layerRef.current;
    if (!layer || !anchor?.isConnected) return;
    const viewport = window.visualViewport;
    const dialogBounds = anchor.closest('dialog')?.getBoundingClientRect();
    const viewLeft = Math.max(viewport?.offsetLeft || 0, dialogBounds?.left || 0);
    const viewTop = Math.max(viewport?.offsetTop || 0, dialogBounds?.top || 0);
    const viewRight = Math.min((viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth), dialogBounds?.right ?? Infinity);
    const viewBottom = Math.min((viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight), dialogBounds?.bottom ?? Infinity);
    const viewWidth = viewRight - viewLeft;
    const viewHeight = viewBottom - viewTop;
    const triggerBounds = anchor.getBoundingClientRect();
    const alignToComposer = ['add', 'ideas', 'model'].includes(kind);
    const composer = anchor.closest('.tb-composer');
    const surface = composer?.querySelector('.tb-composer-surface') || composer;
    const bounds = alignToComposer && surface ? surface.getBoundingClientRect() : triggerBounds;
    const layerWidth = Math.min(width, Math.max(0, viewWidth - 24));
    const above = Math.max(0, bounds.top - viewTop - 20);
    const below = Math.max(0, viewTop + viewHeight - bounds.bottom - 20);
    const desiredHeight = Math.min(maxHeight, layer.scrollHeight + 2);
    // Prefer opening below, shrinking the scrollable body to fit. Only flip
    // when there is not enough room for even one usable menu row.
    const side = below >= Math.min(desiredHeight, 48) || below >= above ? 'bottom' : 'top';
    const height = Math.min(maxHeight, Math.max(0, viewHeight - 24), side === 'bottom' ? below : above);
    const left = Math.min(viewLeft + viewWidth - layerWidth - 12, Math.max(viewLeft + 12, ['model', 'runtime', 'approval'].includes(kind) ? bounds.right - layerWidth : bounds.left));
    const shownHeight = Math.min(desiredHeight, height);
    const preferredTop = side === 'bottom' ? bounds.bottom + 8 : bounds.top - shownHeight - 8;
    const top = Math.min(viewTop + viewHeight - shownHeight - 12, Math.max(viewTop + 12, preferredTop));
    // A backdrop-filtered ancestor establishes a containing block for fixed
    // descendants. Bounds above are viewport coordinates; CSS offsets are local.
    const containingBlock = layer.offsetParent;
    const containingBounds = containingBlock?.getBoundingClientRect();
    const localLeft = left - (containingBounds ? containingBounds.left + containingBlock.clientLeft - containingBlock.scrollLeft : 0);
    const localTop = top - (containingBounds ? containingBounds.top + containingBlock.clientTop - containingBlock.scrollTop : 0);
    setGeometry(current => current && current.left === localLeft && current.top === localTop && current.width === layerWidth && current.maxHeight === height && current.side === side
      ? current : { left: localLeft, top: localTop, width: layerWidth, maxHeight: height, side });
  }

  // Initial placement and real content changes need a measurement, not every
  // render caused by the resulting coordinates themselves.
  useLayoutEffect(position, [anchor, kind, width, maxHeight, children]);
  useLayoutEffect(() => {
    if (!geometry) return;
    const layer = layerRef.current;
    const target = layer.querySelector('[data-composer-initial], [aria-checked="true"]') || layer.querySelector('input, textarea, button');
    target?.focus({ preventScroll: true });
    if (target && !isDialog) {
      const scrollArea = target.closest('.tb-model-options') || layer;
      const offset = target.getBoundingClientRect().bottom - scrollArea.getBoundingClientRect().bottom + 6;
      if (offset > 0) scrollArea.scrollTop += offset;
    }
  }, [Boolean(geometry)]);
  useEffect(() => {
    const outside = event => {
      if (closing) return;
      if (layerRef.current?.contains(event.target) || anchor?.contains(event.target)) return;
      closeRef.current(false);
    };
    let frame = 0;
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; position(); });
    };
    const observer = new ResizeObserver(schedulePosition);
    const composer = anchor?.closest('.tb-composer-wrap');
    if (layerRef.current) observer.observe(layerRef.current);
    if (anchor) observer.observe(anchor);
    composer?.addEventListener('composergeometrychange', schedulePosition);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, true);
    window.visualViewport?.addEventListener('resize', schedulePosition);
    window.visualViewport?.addEventListener('scroll', schedulePosition);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      composer?.removeEventListener('composergeometrychange', schedulePosition);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', schedulePosition);
      window.removeEventListener('scroll', schedulePosition, true);
      window.visualViewport?.removeEventListener('resize', schedulePosition);
      window.visualViewport?.removeEventListener('scroll', schedulePosition);
    };
  }, [anchor, kind, width, maxHeight, closing]);

  function keydown(event) {
    event.stopPropagation();
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); closeRef.current(true); return; }
    const menuItems = [...layerRef.current.querySelectorAll('[data-composer-menu-item]:not(:disabled)')];
    const current = menuItems.indexOf(document.activeElement);
    if (!isDialog && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? menuItems.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : menuItems.length - 1)) % menuItems.length;
      menuItems[next]?.focus();
    }
    if (event.key === 'Tab') {
      const controls = [...layerRef.current.querySelectorAll('input:not(:disabled), textarea, button:not(:disabled)')];
      const atEdge = event.shiftKey ? document.activeElement === controls[0] : document.activeElement === controls.at(-1);
      if (!isDialog || atEdge) {
        event.preventDefault();
        closeRef.current(false);
        focusBesideTrigger(anchor, event.shiftKey ? -1 : 1);
      }
    }
  }

  return createPortal(<div
    ref={layerRef}
    data-composer-owner={anchor?.closest('[data-composer-owner]')?.dataset.composerOwner}
    id={id}
    className={`dropdown-surface tb-composer-popover tb-composer-${kind}-menu`}
    role={isDialog ? 'dialog' : 'menu'}
    aria-label={label}
    data-placement={geometry?.side}
    data-closing={closing || undefined}
    inert={closing}
    aria-hidden={closing || undefined}
    style={geometry ? { left: geometry.left, top: geometry.top, width: geometry.width, maxHeight: geometry.maxHeight } : { width, visibility: 'hidden' }}
    onKeyDown={keydown}
  >{children}</div>, anchor?.closest('dialog') || getHomeRoot());
}

export const Composer = forwardRef(function Composer({ onSubmit, onHandoff, onVoice, onOverlayChange, externalOverlayOpen = false, initialSkill = null, initialQuery = '', initialDraft = null, simple = false }, ref) {
  const id = useId();
  const [query, setQuery] = useState(initialDraft?.query ?? initialQuery);
  const [skill, setSkill] = useState(initialDraft ? initialDraft.skill : initialSkill);
  const skillRef = useRef(null);
  const [skillWidth, setSkillWidth] = useState(0);
  const [skillStacked, setSkillStacked] = useState(false);
  const [skillScrollTop, setSkillScrollTop] = useState(0);
  const [mode, setMode] = useState('对话');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [runLocation, setRunLocation] = useState('cloud');
  const [approvalPolicy, setApprovalPolicy] = useState('full');
  const [modelSelection, setModelSelection] = useState(() => readModelSelection(initialDraft));
  const model = modelSelection.models[0] || 'Auto';
  const modelLabel = modelSelection.multiple ? `${modelSelection.models.length} 个模型` : model;
  const modelSummary = modelSelection.models.join('、');
  const [references, setReferences] = useState(initialDraft?.references || []);
  const [attachments, setAttachments] = useState([]);
  const [fileError, setFileError] = useState('');
  const [overlay, setOverlay] = useState(null);
  const [commandEditor, setCommandEditor] = useState(false);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [customCommands, setCustomCommands] = useState(() => {
    try { return readCustomCommands(window.localStorage); } catch { return []; }
  });
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const inputFrameRef = useRef(null);
  const inputMeasureRef = useRef(null);
  const [inputHeight, setInputHeight] = useState(50);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const projectFolderInputRef = useRef(null);
  const projectFolderResolveRef = useRef(null);
  const triggers = useRef({});
  const filesRef = useRef([]);
  const objectUrls = useRef(new Set());
  const compositionRef = useRef(false);
  const callbackRef = useRef(onOverlayChange);
  callbackRef.current = onOverlayChange;
  const anyOverlay = Boolean(overlay || commandEditor || filePickerOpen);
  const canSend = Boolean(skill || query.trim() || attachments.length || references.length);
  const selectedProject = projects.find(project => project.id === selectedProjectId);
  const taskMode = mode === '任务';
  const localTask = taskMode && runLocation === 'local';
  const selectedApproval = APPROVAL_POLICIES.find(entry => entry.id === approvalPolicy) || APPROVAL_POLICIES[0];
  const dockControlsHidden = useComposerScroll(wrapRef, {
    overlayOpen: anyOverlay || externalOverlayOpen,
  });

  function focusInput(options) {
    const input = inputRef.current;
    if (!input) return;
    if (options?.atEnd) input.setSelectionRange(input.value.length, input.value.length);
    input.focus({ preventScroll: true });
  }
  function closeOverlays() { setOverlay(null); setCommandEditor(false); }
  function fillPrompt(text) { setQuery(String(text || '')); setOverlay(null); requestAnimationFrame(focusInput); }
  function removeSkill() { setSkill(null); requestAnimationFrame(focusInput); }
  useImperativeHandle(ref, () => ({
    focus: focusInput, closeOverlays, setPrompt: fillPrompt,
    startNew: (prompt = '') => {
      objectUrls.current.forEach(url => URL.revokeObjectURL(url));
      objectUrls.current.clear();
      changeFiles([]); setReferences([]); setSkill(null); setMode('对话');
      closeOverlays(); fillPrompt(prompt);
    },
    applySkill: next => { setSkill(next); setMode('对话'); closeOverlays(); requestAnimationFrame(focusInput); },
  }), []);

  useEffect(() => { onOverlayChange?.(anyOverlay); }, [anyOverlay, onOverlayChange]);
  useLayoutEffect(() => {
    const frame = inputFrameRef.current;
    const chip = skillRef.current;
    if (!skill || !frame || !chip) { setSkillWidth(0); setSkillStacked(false); return; }
    const measure = () => {
      const width = chip.getBoundingClientRect().width + 4;
      setSkillWidth(width);
      setSkillStacked(width > frame.clientWidth - 32);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(chip);
    return () => observer.disconnect();
  }, [skill]);
  useEffect(() => () => {
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    callbackRef.current?.(false);
  }, []);
  useEffect(() => {
    if (!initialDraft?.attachments?.length) return;
    // The library owns its old blob URLs. Create independent previews here so
    // closing the library cannot revoke the receiving composer's thumbnails.
    changeFiles(initialDraft.attachments.map(({ previewUrl: previousUrl, ...entry }) => {
      let previewUrl = null;
      if (entry.file && isPreviewableImage(entry.file)) {
        previewUrl = URL.createObjectURL(entry.file);
        objectUrls.current.add(previewUrl);
      }
      return { ...entry, previewUrl };
    }));
  }, []);
  useLayoutEffect(() => {
    const frame = inputFrameRef.current;
    let measuredWidth = 0;
    function measure() {
      // A hidden mirror avoids moving the focused textarea/caret during measurement.
      // Always use the expanded width, even while the visible input is a single line.
      setInputHeight(Math.min(160, Math.max(50, inputMeasureRef.current.scrollHeight)));
      measuredWidth = frame.clientWidth;
    }
    measure();
    const observer = new ResizeObserver(() => { if (frame.clientWidth !== measuredWidth) measure(); });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [query, skillWidth, skillStacked]);

  useEffect(() => {
    const inputs = [fileInputRef.current, folderInputRef.current];
    const cancel = () => setFilePickerOpen(false);
    inputs.forEach(input => input?.addEventListener('cancel', cancel));
    return () => inputs.forEach(input => input?.removeEventListener('cancel', cancel));
  }, []);
  useEffect(() => {
    const input = projectFolderInputRef.current;
    const cancel = () => {
      projectFolderResolveRef.current?.(null);
      projectFolderResolveRef.current = null;
      setFilePickerOpen(false);
    };
    input?.addEventListener('cancel', cancel);
    return () => {
      input?.removeEventListener('cancel', cancel);
      projectFolderResolveRef.current?.(null);
    };
  }, []);
  useEffect(() => {
    if (!filePickerOpen) return;
    let timer;
    const returned = () => { timer = window.setTimeout(() => setFilePickerOpen(false), 300); };
    window.addEventListener('focus', returned);
    return () => { window.removeEventListener('focus', returned); clearTimeout(timer); };
  }, [filePickerOpen]);

  function toggleOverlay(kind) {
    setOverlay(current => current === kind ? null : kind);
  }

  function changeMode(nextMode) {
    setOverlay(null);
    setMode(nextMode);
    focusInput();
  }

  function openFiles() {
    setOverlay(null);
    setFilePickerOpen(true);
    fileInputRef.current?.click();
  }

  function openFolder() {
    setOverlay(null);
    setFilePickerOpen(true);
    folderInputRef.current?.click();
  }

  function addReferences(entries) {
    setReferences(current => [...current, ...entries.filter(entry => !current.some(existing => existing.url === entry.url))]);
    setOverlay(null);
    requestAnimationFrame(focusInput);
  }

  function createProject(name, source = 'manual') {
    const checked = validateProjectName(projects, name);
    if (!checked.ok) return checked;
    const project = { id: crypto.randomUUID(), name: checked.name, source };
    setProjects(current => [project, ...current]);
    setSelectedProjectId(project.id);
    return { ok: true, id: project.id };
  }

  function selectProject(projectId) {
    setSelectedProjectId(projectId);
    setProjects(current => promoteProject(current, projectId));
  }

  function renameProject(projectId, name) {
    const checked = validateProjectName(projects, name, projectId);
    if (!checked.ok) return checked;
    setProjects(current => current.map(project => project.id === projectId ? { ...project, name: checked.name } : project));
    return { ok: true };
  }

  function deleteProject(projectId) {
    setProjects(current => current.filter(project => project.id !== projectId));
    setSelectedProjectId(current => current === projectId ? null : current);
  }

  async function createProjectFromFolder() {
    setFilePickerOpen(true);
    try {
      let name;
      if (typeof window.showDirectoryPicker === 'function') {
        const directory = await window.showDirectoryPicker({ mode: 'read' });
        name = directory.name;
      } else {
        name = await new Promise(resolve => {
          projectFolderResolveRef.current = resolve;
          projectFolderInputRef.current?.click();
        });
      }
      if (!name) return { ok: false };
      const result = createProject(name, 'folder');
      if (result.ok) setRunLocation('local');
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false };
      return { ok: false, message: '无法选择文件夹，请重试或手动创建项目。' };
    } finally {
      setFilePickerOpen(false);
    }
  }

  function receiveProjectFolder(event) {
    const firstFile = event.target.files?.[0];
    const name = firstFile?.webkitRelativePath?.split('/')[0] || null;
    event.target.value = '';
    projectFolderResolveRef.current?.(name);
    projectFolderResolveRef.current = null;
  }

  function closePopover(restoreFocus = true) {
    const trigger = triggers.current[overlay];
    setOverlay(null);
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  }

  function changeFiles(next) { filesRef.current = next; setAttachments(next); }
  function revoke(url) { if (url) { URL.revokeObjectURL(url); objectUrls.current.delete(url); } }
  function addFiles(event) {
    setFilePickerOpen(false);
    const { accepted, errors } = partitionAttachments(Array.from(event.target.files || []), filesRef.current.length, filesRef.current);
    const added = accepted.map(file => {
      let previewUrl = null;
      if (isPreviewableImage(file)) {
        try { previewUrl = URL.createObjectURL(file); objectUrls.current.add(previewUrl); } catch { /* Keep an ordinary file pill when a preview cannot be created. */ }
      }
      return { id: crypto.randomUUID(), name: file.name, relativePath: file.webkitRelativePath || '', type: file.type, size: file.size, lastModified: file.lastModified, previewUrl, file };
    });
    changeFiles([...filesRef.current, ...added]);
    setFileError(errors.slice(0, 3).join('；') + (errors.length > 3 ? `；另有 ${errors.length - 3} 个文件未添加` : ''));
    event.target.value = '';
    focusInput();
  }

  function removeFile(file) {
    revoke(file.previewUrl);
    changeFiles(filesRef.current.filter(entry => entry.id !== file.id));
    setFileError('');
    focusInput();
  }

  function previewFailed(file) {
    revoke(file.previewUrl);
    changeFiles(filesRef.current.map(entry => entry.id === file.id ? { ...entry, previewUrl: null } : entry));
  }

  function submit(event) {
    event?.preventDefault();
    if (compositionRef.current || !canSend) { focusInput(); return; }
    if (modelSelection.multiple && modelSelection.models.length < MIN_REPLY_MODELS) {
      setOverlay('model');
      return;
    }
    setOverlay(null);
    if (onHandoff) {
      onHandoff({ query, skill, model, models: modelSelection.models, multiModel: modelSelection.multiple, references, attachments: filesRef.current });
      return;
    }
    onSubmit?.({ query: `${skill?.prompt || ''}${query}`.trim(), skill, mode, model: modelSummary, models: modelSelection.models, multiModel: modelSelection.multiple, reference: references.map(entry => `${entry.title}\n${entry.url}`).join('\n\n'),
      taskContext: taskMode ? {
        project: selectedProject?.name || '', plugins: [], runLocation,
        approvalPolicy: localTask ? selectedApproval?.name || '' : '',
      } : null,
      attachments: filesRef.current.map(({ previewUrl, file: sourceFile, ...file }) => ({ ...file, isImage: Boolean(previewUrl) })) });
  }

  function persistCommands(next) {
    try { localStorage.setItem(COMMAND_STORAGE_KEY, JSON.stringify(next)); }
    catch { return { ok: false, message: '无法保存到本地，请检查浏览器存储权限后重试。' }; }
    setCustomCommands(next);
    return { ok: true };
  }

  function saveCommand(name, prompt, editingId = null) {
    name = name.trim();
    prompt = prompt.trim();
    if (!name || !prompt) return { ok: false, message: '请填写妙招名称和提示词。' };
    if (name.length > 40 || prompt.length > 4000) return { ok: false, message: '名称最多 40 个字符，提示词最多 4000 个字符。' };
    if (editingId && !customCommands.some(command => command.id === editingId)) return { ok: false, message: '这个妙招已不存在，请重新选择。' };
    if (!editingId && customCommands.length >= 30) return { ok: false, message: '最多保存 30 个自定义妙招。' };
    if ([...IDEAS, ...DEFAULT_COMMANDS, ...customCommands.filter(command => command.id !== editingId)].some(command => command.name === name)) return { ok: false, message: '已有同名妙招，请换一个名称。' };
    return persistCommands(editingId
      ? customCommands.map(command => command.id === editingId ? { ...command, name, prompt } : command)
      : [...customCommands, { id: crypto.randomUUID(), name, prompt }]);
  }

  function deleteCommand(commandId) {
    return persistCommands(customCommands.filter(command => command.id !== commandId));
  }

  return <div ref={wrapRef} className="tb-composer-wrap" data-composer-owner={id} style={{ '--composer-input-height': `${inputHeight}px`, '--composer-skill-indent': `${skillWidth}px` }}>
    <form className="tb-composer" onSubmit={submit}>
      <div className="tb-composer-surface" aria-hidden="true" onClick={() => focusInput()}/>
      <input ref={fileInputRef} type="file" multiple hidden onChange={addFiles} aria-label="选择本地文件" />
      <input ref={folderInputRef} type="file" multiple webkitdirectory="" hidden onChange={addFiles} aria-label="选择本地文件夹" />
      <input ref={projectFolderInputRef} type="file" multiple webkitdirectory="" hidden onChange={receiveProjectFolder} aria-label="选择项目文件夹" />
      {attachments.length > 0 && <div className="tb-composer-attachments" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} role="list" aria-label="已添加的文件">
        {attachments.map(file => <div role="listitem" key={file.id} className={`tb-composer-attachment${file.previewUrl ? ' is-image' : ''}`}>
          {file.previewUrl ? <img src={file.previewUrl} alt={file.name} onError={() => previewFailed(file)} /> : <><span className="tb-attachment-icon"><Paperclip size={20} /></span><span className="tb-attachment-copy"><strong title={file.name}>{file.name}</strong><small>{file.name.includes('.') ? file.name.split('.').at(-1).toLowerCase() : '文件'} · {formatAttachmentSize(file.size)}</small></span></>}
          <button type="button" className="tb-attachment-remove" aria-label={`移除文件：${file.name}`} onClick={() => removeFile(file)}><X size={11} /></button>
        </div>)}
      </div>}
      {references.length > 0 && <div className="tb-composer-references" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} role="list" aria-label="已添加的参考内容">{references.map(entry => <div className="tb-reference-chip" role="listitem" key={entry.url}>{entry.kind === 'bookmark' ? <Star size={13} /> : <Globe size={13} />}<span title={`${entry.title}\n${entry.url}`}>{entry.title}</span><button type="button" aria-label={`移除参考：${entry.title}`} onClick={() => { setReferences(current => current.filter(item => item.url !== entry.url)); focusInput(); }}><X size={12} /></button></div>)}</div>}
      <div ref={inputFrameRef} className={`tb-composer-input-frame${skill ? ' has-skill' : ''}${skillStacked ? ' is-skill-stacked' : ''}`}>
      <div ref={inputMeasureRef} className="tb-composer-input-measure" aria-hidden="true">{skill && <span className="tb-composer-skill-spacer" />}{query + '\u200b'}</div>
      {skill && <span ref={skillRef} className="tb-composer-skill" title={`妙招：${skill.name}`} style={{ transform: `translateY(-${skillScrollTop}px)` }}>
        <Lightbulb size={16} aria-hidden="true" />
        <span id={`${id}-skill`}>{skill.name}</span>
        <button type="button" aria-label={`移除妙招：${skill.name}`} onClick={removeSkill}><X size={12} aria-hidden="true" /></button>
      </span>}
      <textarea
        ref={inputRef}
        className="tb-composer-input"
        value={query}
        rows={2}
        aria-label={initialSkill ? '补充小组件需求' : '输入关键词搜索'}
        aria-describedby={skill ? `${id}-skill` : undefined}
        placeholder={skill ? '' : localTask ? '描述希望在本地电脑上完成的任务' : taskMode ? '描述你想完成的任务' : '输入关键词搜索'}
        onChange={event => setQuery(event.target.value)}
        onScroll={event => setSkillScrollTop(event.currentTarget.scrollTop)}
        onCompositionStart={() => { compositionRef.current = true; }}
        onCompositionEnd={() => { compositionRef.current = false; }}
        onKeyDown={event => {
          if (skill && event.key === 'Backspace' && !event.nativeEvent.isComposing && !compositionRef.current && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0) {
            event.preventDefault(); removeSkill(); return;
          }
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && !compositionRef.current) {
            event.preventDefault(); submit();
          }
        }}
      />
      </div>
      {fileError && <div className="tb-composer-file-error" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} role="alert"><span>{fileError}</span><button type="button" aria-label="关闭文件提示" onClick={() => setFileError('')}><X size={13} /></button></div>}
      <div className="tb-composer-toolbar">
        <div className="tb-composer-start">
          <button ref={node => { triggers.current.add = node; }} type="button" className={`tb-composer-icon tb-composer-plus${overlay === 'add' ? ' is-open' : ''}`} aria-label="添加参考内容" aria-haspopup="dialog" aria-expanded={overlay === 'add'} aria-controls={overlay === 'add' ? `${id}-add` : undefined} onClick={() => toggleOverlay('add')}><Plus size={18} /></button>
          {!simple && <>
          <div className="tb-composer-modes" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} role="group" aria-label="搜索模式">{['对话', '任务'].map(value => <button type="button" key={value} aria-pressed={mode === value} aria-controls={value === '任务' ? `${id}-mount` : undefined} onClick={() => changeMode(value)}>{value}</button>)}</div>
          <button ref={node => { triggers.current.ideas = node; }} type="button" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} className={`tb-composer-icon tb-composer-ideas${overlay === 'ideas' ? ' is-open' : ''}`} aria-label="妙招" title="妙招" aria-haspopup="dialog" aria-expanded={overlay === 'ideas'} aria-controls={overlay === 'ideas' ? `${id}-ideas` : undefined} onClick={() => toggleOverlay('ideas')}><Lightbulb size={18} aria-hidden="true" /></button>
          </>}
        </div>
        <div className="tb-composer-end">
          <button ref={node => { triggers.current.model = node; }} type="button" className="tb-model-trigger" aria-label={`选择模型：${modelLabel}`} title={modelSummary || '选择模型'} aria-haspopup="menu" aria-expanded={overlay === 'model'} aria-controls={overlay === 'model' ? `${id}-model` : undefined} onClick={() => toggleOverlay('model')}><span>{modelLabel}</span><ChevronDown size={14} /></button>
          <button type="button" className="tb-composer-icon tb-composer-voice" aria-label="语音输入" title="语音输入" onClick={() => { closeOverlays(); if (onVoice) onVoice(); else setFileError('语音输入尚未接入，可以直接输入小组件需求。'); }}><Mic size={18} aria-hidden="true" /></button>
          <button type="submit" className="tb-composer-send" aria-label="发送" title="发送"><ArrowUp size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </form>

    <div id={`${id}-mount`} className={`tb-task-mount-reveal${taskMode ? ' is-expanded' : ''}`} data-dock-secondary inert={!taskMode || dockControlsHidden} aria-hidden={!taskMode || dockControlsHidden}>
      <div className="tb-task-mount" role="group" aria-label="任务挂载区">
        <div className="tb-task-mount-controls">
          <button ref={node => { triggers.current.project = node; }} type="button" className={`tb-task-mount-button tb-task-project${overlay === 'project' ? ' is-open' : ''}`} aria-label={selectedProject ? `选择项目：${selectedProject.name}` : '选择项目'} title={selectedProject?.name || '选择项目'} aria-haspopup="dialog" aria-expanded={overlay === 'project'} aria-controls={overlay === 'project' ? `${id}-project` : undefined} onClick={() => toggleOverlay('project')}><Folder size={16} /><span>{selectedProject?.name || '选择项目'}</span></button>
        </div>
        <div className="tb-task-mount-end">
          {!simple && localTask && <button ref={node => { triggers.current.approval = node; }} type="button" className={`tb-local-task-trigger${overlay === 'approval' ? ' is-open' : ''}${approvalPolicy === 'full' ? ' is-full-access' : ''}`} aria-label={`审批策略：${selectedApproval.name}`} aria-haspopup="menu" aria-expanded={overlay === 'approval'} aria-controls={overlay === 'approval' ? `${id}-approval` : undefined} onClick={() => toggleOverlay('approval')}><selectedApproval.Icon size={16} aria-hidden="true" /><span>{selectedApproval.name}</span><ChevronDown className="tb-local-task-chevron" size={14} aria-hidden="true" /></button>}
          <button ref={node => { triggers.current.runtime = node; }} type="button" className={`tb-task-runtime${overlay === 'runtime' ? ' is-open' : ''}`} aria-label={`运行位置：${runLocation === 'cloud' ? '云端' : '本地'}`} title={runLocation === 'cloud' ? '在云端运行' : '在你的计算机上运行'} aria-haspopup="menu" aria-expanded={overlay === 'runtime'} aria-controls={overlay === 'runtime' ? `${id}-runtime` : undefined} onClick={() => toggleOverlay('runtime')}>{runLocation === 'cloud' ? <Cloud size={17} aria-hidden="true" /> : <Laptop size={17} aria-hidden="true" />}<span>{runLocation === 'cloud' ? '云端' : '本地'}</span></button>
        </div>
      </div>
    </div>

    {taskMode && ['project', 'runtime'].includes(overlay) && <TaskMountMenus key={overlay} kind={overlay} anchor={triggers.current[overlay]} id={`${id}-${overlay}`} Popover={ComposerPopover} onClose={closePopover}
      projects={projects} onCreateProject={createProject} selectedProjectId={selectedProjectId} onSelectProject={selectProject}
      onRenameProject={renameProject} onDeleteProject={deleteProject} onCreateFromFolder={createProjectFromFolder}
      runLocation={runLocation} onRunLocationChange={setRunLocation} />}
    {localTask && overlay === 'approval' && <LocalTaskMenus anchor={triggers.current.approval} id={`${id}-approval`} Popover={ComposerPopover} onClose={closePopover}
      approvalPolicy={approvalPolicy} onApprovalPolicyChange={setApprovalPolicy} />}

    <ComposerPopoverPresence active={overlay === 'model'}><ComposerPopover key="model" anchor={triggers.current.model} kind="model" id={`${id}-model`} label="选择模型" width={280} maxHeight={430} onClose={closePopover}>
      <ComposerModelMenu selection={modelSelection}
        onSelect={name => { setModelSelection(current => toggleReplyModel(current, name)); if (!modelSelection.multiple) closePopover(); }}
        onModeChange={multiple => setModelSelection(current => setReplyModelMode(current, multiple))} />
    </ComposerPopover></ComposerPopoverPresence>
    <ComposerPopoverPresence active={overlay === 'add'}><ComposerPopover key="add" anchor={triggers.current.add} kind="add" id={`${id}-add`} label="添加参考内容" width={280} maxHeight={430} onClose={closePopover}>
      <ComposerAddMenu onReferences={addReferences} onFiles={openFiles} onFolder={openFolder} />
    </ComposerPopover></ComposerPopoverPresence>
    <ComposerPopoverPresence active={overlay === 'ideas'}><ComposerPopover key="ideas" anchor={triggers.current.ideas} kind="ideas" id={`${id}-ideas`} label="妙招" width={280} maxHeight={430} onClose={closePopover}>
      <ComposerIdeasMenu customCommands={customCommands} onSelect={(prompt, nextMode) => { setSkill(null); if (nextMode) setMode(nextMode); fillPrompt(prompt); }} onCreate={() => { setOverlay(null); setCommandEditor('create'); }} onManage={() => { setOverlay(null); setCommandEditor('manage'); }} />
    </ComposerPopover></ComposerPopoverPresence>
    {commandEditor && <ComposerIdeasManager initialCreate={commandEditor === 'create'} customCommands={customCommands} onSave={saveCommand} onDelete={deleteCommand} onClose={() => setCommandEditor(false)} returnFocus={triggers.current.ideas} owner={id} />}
  </div>;
});

export default Composer;
