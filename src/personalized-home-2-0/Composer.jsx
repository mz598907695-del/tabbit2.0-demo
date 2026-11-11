import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import ComposerPopover from './ComposerPopover';
import { ArrowUp, ChevronDown, Cloud, Folder, Globe, Laptop, Lightbulb, Mic, Paperclip, Plus, Star, X } from "./icons";
import { COMMAND_STORAGE_KEY, DEFAULT_COMMANDS, formatAttachmentSize, isPreviewableImage, partitionAttachments, readCustomCommands } from './composer-data';
import { MIN_REPLY_MODELS, readModelSelection, setReplyModelMode, toggleReplyModel } from './composer-models';
import { promoteProject, validateProjectName } from './composer-projects';
import ComposerModelMenu from './ComposerModelMenu';
import TaskMountMenus from './TaskMountMenus';
import LocalTaskMenus, { APPROVAL_POLICIES } from './LocalTaskMenus';
import ComposerAddMenu from './ComposerAddMenu';
import ComposerExpansion from './ComposerExpansion';
import ComposerWeather from './ComposerWeather';
import ComposerInlinePanel from './ComposerInlinePanel';
import ComposerIdeasMenu, { IDEAS } from './ComposerIdeasMenu';
import ComposerIdeasManager from './ComposerIdeasManager';
import { useComposerScroll } from './useComposerScroll';
import { useTaskShockwave } from './useTaskShockwave';
import './composer.css';
import './task-mount.css';
import './composer-scroll.css';

const INLINE_PANEL_LABELS = { add: '添加参考内容' };

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
  const [runLocation, setRunLocation] = useState('local');
  const [approvalPolicy, setApprovalPolicy] = useState('ask');
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
  const taskShockwave = useTaskShockwave(wrapRef, mode);
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
  const inlineKind = INLINE_PANEL_LABELS[overlay] ? overlay : null;
  const expansionKind = inlineKind || (taskMode ? 'task' : null);
  const localTask = taskMode && runLocation === 'local';
  const selectedApproval = APPROVAL_POLICIES.find(entry => entry.id === approvalPolicy) || APPROVAL_POLICIES[0];
  const dockControlsHidden = useComposerScroll(wrapRef, {
    overlayOpen: anyOverlay || externalOverlayOpen,
  });

  useLayoutEffect(() => {
    const owner = wrapRef.current;
    if (!owner?.hasAttribute('data-mode-switch-instant')) return;
    // Commit the new geometry without transitions before restoring normal picker motion.
    owner.getBoundingClientRect();
    owner.removeAttribute('data-mode-switch-instant');
    if (owner.parentElement?.classList.contains('home-feed')) {
      owner.closest('.home-content')?.removeAttribute('data-mode-switch-instant');
    }
  }, [mode]);

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

  useEffect(() => {
    if (!inlineKind) return;
    const outside = event => {
      if (wrapRef.current?.contains(event.target)) return;
      setOverlay(current => INLINE_PANEL_LABELS[current] ? null : current);
    };
    const focusout = event => {
      if (event.relatedTarget && !wrapRef.current?.contains(event.relatedTarget)) setOverlay(current => INLINE_PANEL_LABELS[current] ? null : current);
    };
    const owner = wrapRef.current;
    document.addEventListener('pointerdown', outside, true);
    owner?.addEventListener('focusout', focusout);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      owner?.removeEventListener('focusout', focusout);
    };
  }, [inlineKind]);

  function expansionKeydown(event) {
    if (!inlineKind || event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePopover();
    }
  }

  function toggleOverlay(kind) {
    setOverlay(current => current === kind ? null : kind);
  }

  function changeMode(nextMode) {
    if (nextMode === '任务' && nextMode !== mode) {
      setRunLocation('local');
      setApprovalPolicy('ask');
      const owner = wrapRef.current;
      owner?.setAttribute('data-mode-switch-instant', '');
      if (owner?.parentElement?.classList.contains('home-feed')) {
        owner.closest('.home-content')?.setAttribute('data-mode-switch-instant', '');
      }
    }
    setOverlay(current => INLINE_PANEL_LABELS[current] ? current : null);
    setMode(nextMode);
    if (!inlineKind) focusInput();
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

  return <div ref={wrapRef} className="tb-composer-wrap" data-expansion={expansionKind || undefined} data-task-mode={taskMode || undefined} data-inline-panel={inlineKind || undefined} onKeyDown={expansionKeydown} data-composer-owner={id} style={{ '--composer-input-height': `${inputHeight}px`, '--composer-skill-indent': `${skillWidth}px` }}>
    <div className="tb-composer-frame">
    <ComposerExpansion kind={taskMode ? 'task' : null} ownerRef={wrapRef} disabled={dockControlsHidden} side="top" heightProperty="--composer-task-height">
      <div id={`${id}-mount`} className="tb-task-mount" role="group" aria-label="任务挂载区">
        <div className="tb-task-mount-controls">
          <button ref={node => { triggers.current.project = node; }} type="button" className={`tb-task-mount-button tb-task-project${overlay === 'project' ? ' is-open' : ''}`} aria-label={selectedProject ? `选择项目：${selectedProject.name}` : '选择项目'} title={selectedProject?.name || '选择项目'} aria-haspopup="dialog" aria-expanded={overlay === 'project'} aria-controls={overlay === 'project' ? `${id}-project` : undefined} onClick={() => toggleOverlay('project')}><Folder size={14} /><span>{selectedProject?.name || '选择项目'}</span></button>
        </div>
        <div className="tb-task-mount-end">
          {!simple && localTask && <button ref={node => { triggers.current.approval = node; }} type="button" className={`tb-local-task-trigger${overlay === 'approval' ? ' is-open' : ''}${approvalPolicy === 'full' ? ' is-full-access' : ''}`} aria-label={`审批策略：${selectedApproval.name}`} aria-haspopup="menu" aria-expanded={overlay === 'approval'} aria-controls={overlay === 'approval' ? `${id}-approval` : undefined} onClick={() => toggleOverlay('approval')}><selectedApproval.Icon size={14} aria-hidden="true" /><span>{selectedApproval.name}</span><ChevronDown className="tb-local-task-chevron" size={12} aria-hidden="true" /></button>}
          <button ref={node => { triggers.current.runtime = node; }} type="button" className={`tb-task-runtime${overlay === 'runtime' ? ' is-open' : ''}`} aria-label={`运行位置：${runLocation === 'cloud' ? '云端' : '本地'}`} title={runLocation === 'cloud' ? '在云端运行' : '在你的计算机上运行'} aria-haspopup="menu" aria-expanded={overlay === 'runtime'} aria-controls={overlay === 'runtime' ? `${id}-runtime` : undefined} onClick={() => toggleOverlay('runtime')}>{runLocation === 'cloud' ? <Cloud size={14} aria-hidden="true" /> : <Laptop size={14} aria-hidden="true" />}<span>{runLocation === 'cloud' ? '云端' : '本地'}</span><ChevronDown className="tb-task-runtime-chevron" size={12} aria-hidden="true" /></button>
        </div>
      </div>
    </ComposerExpansion>
    <form className="tb-composer" onSubmit={submit}>
      <div className="tb-composer-surface" aria-hidden="true" onClick={() => focusInput()}/>
      <ComposerWeather />
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
          <div className="tb-composer-modes" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} role="group" aria-label="搜索模式">{['对话', '任务'].map(value => <button type="button" key={value} {...(value === '任务' ? taskShockwave : {})} aria-pressed={mode === value} aria-controls={value === '任务' ? `${id}-mount` : undefined} onClick={() => changeMode(value)}>{value}</button>)}</div>
          <button ref={node => { triggers.current.ideas = node; }} type="button" data-dock-secondary inert={dockControlsHidden} aria-hidden={dockControlsHidden} className={`tb-composer-icon tb-composer-ideas${overlay === 'ideas' ? ' is-open' : ''}`} aria-label="妙招" title="妙招" aria-haspopup="menu" aria-expanded={overlay === 'ideas'} aria-controls={overlay === 'ideas' ? `${id}-ideas` : undefined} onClick={() => toggleOverlay('ideas')}><Lightbulb size={18} aria-hidden="true" /></button>
          </>}
        </div>
        <div className="tb-composer-end">
          <button ref={node => { triggers.current.model = node; }} type="button" className={`tb-model-trigger${overlay === 'model' ? ' is-open' : ''}`} aria-label={`选择模型：${modelLabel}`} title={modelSummary || '选择模型'} aria-haspopup="menu" aria-expanded={overlay === 'model'} aria-controls={overlay === 'model' ? `${id}-model` : undefined} onClick={() => toggleOverlay('model')}><span>{modelLabel}</span><ChevronDown size={14} /></button>
          <button type="button" className="tb-composer-icon tb-composer-voice" aria-label="语音输入" title="语音输入" onClick={() => { closeOverlays(); if (onVoice) onVoice(); else setFileError('语音输入尚未接入，可以直接输入小组件需求。'); }}><Mic size={18} aria-hidden="true" /></button>
          <button type="submit" className="tb-composer-send" aria-label="发送" title="发送"><ArrowUp size={18} aria-hidden="true" /></button>
        </div>
      </div>
    </form>

    <ComposerExpansion kind={inlineKind} ownerRef={wrapRef} disabled={dockControlsHidden} reserveTaskSpace={taskMode}>
      {inlineKind && <ComposerInlinePanel key={inlineKind} kind={inlineKind} id={`${id}-${inlineKind}`} label={INLINE_PANEL_LABELS[inlineKind]} active={!dockControlsHidden}>
        {inlineKind === 'add' && <ComposerAddMenu active={!dockControlsHidden} onReferences={addReferences} onFiles={openFiles} onFolder={openFolder}/>}
        {inlineKind === 'model' && <ComposerModelMenu selection={modelSelection}
          onSelect={name => { setModelSelection(current => toggleReplyModel(current, name)); if (!modelSelection.multiple) closePopover(); }}
          onModeChange={multiple => setModelSelection(current => setReplyModelMode(current, multiple))}/>}
        {inlineKind === 'ideas' && <ComposerIdeasMenu customCommands={customCommands}
          onSelect={(prompt, nextMode) => { setSkill(null); if (nextMode) changeMode(nextMode); fillPrompt(prompt); }}
          onCreate={() => { setOverlay(null); setCommandEditor('create'); }} onManage={() => { setOverlay(null); setCommandEditor('manage'); }}/>}
      </ComposerInlinePanel>}
    </ComposerExpansion>
    </div>

    {overlay === 'model' && <ComposerPopover anchor={triggers.current.model} kind="model" id={`${id}-model`} label="选择模型" width={280} maxHeight={430} onClose={closePopover}>
      <ComposerModelMenu selection={modelSelection}
        onSelect={name => { setModelSelection(current => toggleReplyModel(current, name)); if (!modelSelection.multiple) closePopover(); }}
        onModeChange={multiple => setModelSelection(current => setReplyModelMode(current, multiple))}/>
    </ComposerPopover>}
    {overlay === 'ideas' && <ComposerPopover anchor={triggers.current.ideas} kind="ideas" id={`${id}-ideas`} label="妙招" width={280} maxHeight={430} onClose={closePopover}>
      <ComposerIdeasMenu
        onSelect={(prompt, nextMode) => { setSkill(null); if (nextMode) setMode(nextMode); fillPrompt(prompt); }}
        onManage={() => { setOverlay(null); setCommandEditor('manage'); }}/>
    </ComposerPopover>}

    {taskMode && ['project', 'runtime'].includes(overlay) && <TaskMountMenus key={overlay} kind={overlay} anchor={triggers.current[overlay]} id={`${id}-${overlay}`} Popover={ComposerPopover} onClose={closePopover}
      projects={projects} onCreateProject={createProject} selectedProjectId={selectedProjectId} onSelectProject={selectProject}
      onRenameProject={renameProject} onDeleteProject={deleteProject} onCreateFromFolder={createProjectFromFolder}
      runLocation={runLocation} onRunLocationChange={setRunLocation} />}
    {localTask && overlay === 'approval' && <LocalTaskMenus anchor={triggers.current.approval} id={`${id}-approval`} Popover={ComposerPopover} onClose={closePopover}
      approvalPolicy={approvalPolicy} onApprovalPolicyChange={setApprovalPolicy} />}

    {commandEditor && <ComposerIdeasManager initialCreate={commandEditor === 'create'} customCommands={customCommands} onSave={saveCommand} onDelete={deleteCommand} onClose={() => setCommandEditor(false)} returnFocus={triggers.current.ideas} owner={id} />}
  </div>;
});

export default Composer;
