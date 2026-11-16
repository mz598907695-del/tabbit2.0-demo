import { useEffect, useId, useRef, useState } from 'react';
import { Plus, Upload, X } from '../icons';
import { SKILL_CATEGORIES } from './workspace-skills';
import { createAssistedSkillDraft, normalizeSkillDraft, parseSkillImport, SKILL_HOME_PATTERN, SKILL_IMPORT_LIMIT, skillEditorDraft, skillVariableReferences } from './skill-editor-utils';
import './skill-editor.css';

const labels = {prompt:'提示词内容',script:'脚本代码',task:'SKILL.md'};
const fields = {prompt:'prompt',script:'code',task:'skillMarkdown'};
export default function SkillEditor({ item = null, onSave, onClose }) {
  const [draft, setDraft] = useState(() => skillEditorDraft(item || {}));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingImport, setPendingImport] = useState(null);
  const [assistant, setAssistant] = useState(false);
  const [request, setRequest] = useState('');
  const [generated, setGenerated] = useState('');
  const ref = useRef(null), contentRef = useRef(null), titleId = useId();
  const kind = draft.skillType, field = fields[kind];
  const patch = values => { setDraft(previous => ({...previous,...values})); setError(''); };
  useEffect(() => {
    const focus = document.activeElement;
    const node = ref.current;
    node.showModal();
    node.querySelector('input')?.focus();
    return () => { node.close(); if (focus?.isConnected && !focus.closest('[inert]')) focus.focus({preventScroll:true}); };
  }, []);
  function updateVariable(index, values) { patch({variables:draft.variables.map((variable,i) => i === index ? {...variable,...values} : variable)}); }
  function insertVariable(name) {
    if (!name.trim()) { setError('请先填写变量名称。'); return; }
    const input = contentRef.current, start = input.selectionStart, end = input.selectionEnd;
    const token = `{{${name.trim()}}}`;
    patch({prompt:draft.prompt.slice(0,start)+token+draft.prompt.slice(end)});
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start+token.length,start+token.length); });
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > SKILL_IMPORT_LIMIT) throw new Error('文件太大，请选择 256 KB 以内的文本文件。');
      const imported = parseSkillImport(file.name,await file.text(),kind);
      setPendingImport({name:file.name,fields:imported}); setError('');
    } catch (cause) { setError(cause.message); }
  }
  function applyImport() {
    const imported = pendingImport.fields;
    // Text imports preserve defaults for any variables that already exist.
    const variables = imported.variables?.map(v => ({...v,defaultValue:('title' in imported ? v.defaultValue : draft.variables.find(old => old.name === v.name)?.defaultValue || v.defaultValue)}));
    patch({...imported,...(variables ? {variables} : {})});
    setNotice(`已导入 ${pendingImport.name}，请检查内容后保存。`); setPendingImport(null);
  }
  function submit(event) {
    event.preventDefault();
    try { onSave(normalizeSkillDraft(draft,item || {})); } catch (cause) { setError(cause.message); }
  }
  function generate() {
    try { setGenerated(createAssistedSkillDraft(kind,request,draft.title)); setError(''); } catch(cause) { setError(cause.message); }
  }
  return <dialog ref={ref} className="aiw-content-dialog aiw-dialog-wide aiws-editor" aria-labelledby={titleId} onCancel={event => {event.preventDefault();event.stopPropagation();onClose();}} onKeyDown={event => {if(event.key === 'Escape')event.stopPropagation();}}>
    <div className="aiw-dialog-heading"><h2 id={titleId}>{item ? '编辑妙招' : '创建妙招'}</h2><button type="button" className="aiw-content-icon-button" aria-label="关闭妙招编辑" onClick={onClose}><X size={18}/></button></div>
    <form className="aiw-content-form aiws-editor-form" onSubmit={submit}>
      <div className="aiw-form-columns"><label>名称<input aria-label="妙招名称" value={draft.title} maxLength={100} required onChange={event => patch({title:event.target.value})} placeholder="给妙招起个容易找到的名字"/></label><label>类型<select aria-label="妙招类型" value={kind} onChange={event => {patch({skillType:event.target.value});setAssistant(false);setGenerated('');setPendingImport(null);}}><option value="prompt">提示词</option><option value="script">网页脚本</option><option value="task">任务</option></select></label></div>
      <div className="aiw-form-columns"><label>简介<input aria-label="妙招简介" value={draft.description} maxLength={500} onChange={event => patch({description:event.target.value})} placeholder="一句话介绍妙招用途"/></label><label>分类<select aria-label="妙招分类" value={draft.category} onChange={event => patch({category:event.target.value})}>{SKILL_CATEGORIES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {kind === 'task' && <label>调用描述<textarea aria-label="调用描述" value={draft.taskDescription} rows={2} onChange={event => patch({taskDescription:event.target.value})} placeholder="告诉模型在什么情况下调用这个任务，例如：用户需要汇总某主题近期研究进展时。"/><small>帮助模型判断何时调用；具体步骤写在 SKILL.md 中。</small></label>}
      <section className="aiws-editor-content" aria-label="妙招内容编辑">
        <div className="aiws-editor-section-heading"><h3>{labels[kind]}</h3><div>{kind !== 'prompt' && <button type="button" className="aiw-button" onClick={() => {setAssistant(!assistant);setGenerated('');}}>跟 Tabbit 对话创建</button>}<label className="aiw-button aiws-import-button"><Upload size={14}/>上传文件<input aria-label="上传妙招文件" type="file" accept=".txt,.md,.js,.json" onChange={importFile}/></label></div></div>
        {assistant && <div className="aiws-assistant" role="region" aria-label="跟 Tabbit 对话创建"><label>你想让妙招做什么？<textarea aria-label="创建需求" value={request} rows={2} onChange={event => setRequest(event.target.value)} placeholder={kind === 'script' ? '例如：提取当前网页的标题、链接和正文' : '例如：每次研究一个新主题时，收集资料并生成摘要'}/></label><div className="aiws-editor-section-heading"><small>当前提供模板草稿，可继续编辑后带回妙招。</small><button type="button" className="aiw-button" onClick={generate}>生成草稿</button></div>{generated && <><label>草稿<textarea aria-label="辅助创建草稿" className="aiws-editor-code" rows={8} value={generated} onChange={event => setGenerated(event.target.value)}/></label><button type="button" className="aiw-button" onClick={() => {patch({[field]:generated,...(kind === 'task' && !draft.taskDescription ? {taskDescription:request.trim()} : {})});setAssistant(false);setNotice('草稿已填入，请检查内容后保存。');}}>应用到妙招内容</button></>}</div>}
        {pendingImport && <div className="aiws-import-preview" role="region" aria-label="文件导入预览"><strong>{pendingImport.name}</strong><small>将替换对应正文。JSON 文件还会更新名称、类型和配置。</small><pre>{pendingImport.fields[fields[pendingImport.fields.skillType]]}</pre><div className="aiw-dialog-actions"><button type="button" className="aiw-button" onClick={() => setPendingImport(null)}>取消导入</button><button type="button" className="aiw-button aiw-button-primary" onClick={applyImport}>确认导入</button></div></div>}
        <textarea ref={contentRef} aria-label={labels[kind]} className={kind === 'prompt' ? '' : 'aiws-editor-code'} value={draft[field]} rows={kind === 'prompt' ? 5 : 8} required onChange={event => patch({[field]:event.target.value})} placeholder={kind === 'prompt' ? '例如：请用 {{语气}} 的语气总结以下内容：{{内容}}' : kind === 'script' ? '// 在这里编写网页脚本' : '# 任务名称\n\n## 执行步骤\n1. …'}/>
        <small>支持 TXT、MD、JS、JSON，最大 256 KB；导入前可预览。</small>
      </section>
      {kind === 'prompt' ? <><section className="aiws-editor-variables" aria-label="变量配置"><div className="aiws-editor-section-heading"><h3>变量</h3><button type="button" className="aiw-button" onClick={() => patch({variables:[...draft.variables,{name:'',defaultValue:''}]})}><Plus size={14}/>添加变量</button></div><small>在正文中使用 {'{{变量名}}'} 引用。默认值可留空。</small>{draft.variables.map((variable,index) => <div className="aiws-variable-row" key={index}><label>变量名称<input aria-label={`变量 ${index+1} 名称`} value={variable.name} onChange={event => updateVariable(index,{name:event.target.value})}/></label><label>默认值<input aria-label={`变量 ${index+1} 默认值`} value={variable.defaultValue} onChange={event => updateVariable(index,{defaultValue:event.target.value})}/></label><button type="button" className="aiw-button" onClick={() => insertVariable(variable.name)}>插入引用</button><button type="button" className="aiw-content-icon-button" aria-label={`删除变量 ${index+1}`} onClick={() => {patch({variables:draft.variables.filter((_,i)=>i!==index)});if(skillVariableReferences(draft.prompt).includes(variable.name.trim()))setNotice(`正文仍引用 ${variable.name}，请一并调整。`);}}><X size={16}/></button></div>)}</section><label className="aiws-editor-checkbox"><input type="checkbox" checked={draft.autoSend} onChange={event => patch({autoSend:event.target.checked})}/>一键发送</label></> : <><div className="aiws-editor-section-heading"><h3>适用网站</h3><button type="button" className="aiw-button" onClick={() => patch({websites:[...new Set([...draft.websites,SKILL_HOME_PATTERN])]})}>添加 Tabbit 首页</button></div><label>网站规则<textarea aria-label="适用网站规则" rows={2} value={draft.websites.join('\n')} onChange={event => patch({websites:event.target.value.split('\n')})} placeholder="https://*.example.com/*"/><small>每行一条。用 * 匹配任意字符；*://*/* 表示全部 HTTP / HTTPS 网站。</small></label>{kind === 'script' && <label>运行方式<select aria-label="运行方式" value={draft.runMode} onChange={event => patch({runMode:event.target.value})}><option value="manual">手动运行</option><option value="auto">自动运行</option></select></label>}</>}
      {notice && <p className="aiws-editor-notice" role="status">{notice}</p>}
      {error && <p className="aiw-form-error" role="alert">{error}</p>}
      <div className="aiw-dialog-actions aiws-editor-footer"><button type="button" className="aiw-button" onClick={onClose}>取消</button><button type="submit" className="aiw-button aiw-button-primary">{item ? '保存修改' : '创建妙招'}</button></div>
    </form>
  </dialog>;
}
