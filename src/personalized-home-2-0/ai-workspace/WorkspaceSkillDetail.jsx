import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Globe, Plus } from '../icons';
import WorkspaceSecondaryPage from './WorkspaceSecondaryPage';
import DropdownPanel from '../../DropdownPanel';
import { getSkillIllustration } from './workspace-skill-icons';
import { getSkillDetails } from './workspace-skill-details';
import './workspace-skill-detail.css';
import SkillPublishDialog, { SkillDialog } from './SkillPublishDialog';
import { buildSkillPublicUrl, getSkillVersions, revokeSkillPublications, unpublishSkill } from './skill-publication';

function Choice({ label, value, options, onChange, description }) {
  return <div className="aiwsd-choice"><h2>{label}</h2><div className="aiws-segments" role="group" aria-label={label}>
    {options.map(([id, text]) => <button key={String(id)} aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}
  </div><p>{description}</p></div>;
}
function TaskDocument({ item, detail }) {
  // Render text as React nodes; saved content never becomes executable HTML.
  return <div className="aiwsd-task-document" tabIndex={0} aria-label="任务说明文档">
    <dl><dt>name</dt><dd>{item.title}</dd><dt>description</dt><dd>{detail.taskDescription}</dd><dt>triggers</dt><dd>{detail.triggers.join('、')}</dd></dl>
    {detail.taskContent.split('\n').map((line, index) => /^#{1,6}\s/.test(line) ? <h4 key={index}>{line.replace(/^#{1,6}\s+/, '')}</h4> : line.trim() ? <p key={index}>{line}</p> : null)}
  </div>;
}
function Gallery({ item, detail, Icon, color }) {
  const [index, setIndex] = useState(0);
  const count = detail.images.length || 3;
  const titles = [item.title, '三步开始，轻松复用', '让每次使用，都有清晰的结果'];
  function change(delta) { setIndex(previous => (previous + delta + count) % count); }
  return <section className="aiwsd-gallery" aria-label="妙招说明图" aria-roledescription="轮播图" onKeyDown={event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); change(event.key === 'ArrowRight' ? 1 : -1); }
  }}>
    <div className="aiwsd-slide" style={{ '--aiws-icon-accent': color }}>
      {detail.images.length ? <img src={detail.images[index].src} alt={detail.images[index].alt || `${item.title}说明图 ${index + 1}`}/> : <div className="aiwsd-illustration" role="img" aria-label={`${titles[index]}。${index === 1 ? detail.steps.join('，') : item.description}`}>
        <span className="aiwsd-gallery-eyebrow">{detail.typeLabel} · 使用示意</span><h2>{titles[index]}</h2>
        {index === 1 ? <div className="aiwsd-steps">{detail.steps.map((step, i) => <div key={step}><span>0{i + 1}</span><strong>{step}</strong>{i < 2 && <ArrowRight size={14}/>}</div>)}</div> : <><span className="aiwsd-art-icon"><Icon size={42} strokeWidth={1.5}/></span><p>{index === 0 ? item.description : '保存常用方法，在需要时再次打开。'}</p></>}
      </div>}
      {count > 1 && <><button className="aiwsd-gallery-arrow is-prev" aria-label="上一张说明图" onClick={() => change(-1)}><ChevronLeft size={18}/></button><button className="aiwsd-gallery-arrow is-next" aria-label="下一张说明图" onClick={() => change(1)}><ChevronRight size={18}/></button></>}
    </div>
    {count > 1 && <div className="aiwsd-gallery-dots" role="group" aria-label="选择说明图">{Array.from({ length: count }, (_, i) => <button key={i} aria-label={`第 ${i + 1} 张说明图`} aria-current={index === i ? 'true' : undefined} onClick={() => setIndex(i)}><span/></button>)}</div>}
    <span className="aiwsd-gallery-status" aria-live="polite">第 {index + 1} 张，共 {count} 张</span>
  </section>;
}
function VersionDropdown({ item, currentVersion }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [availableHeight, setAvailableHeight] = useState(360);
  const [placement, setPlacement] = useState('bottom');
  const root = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const versions = getSkillVersions(item);
  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({preventScroll:true});
  }
  useLayoutEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const measure = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const host = trigger.current.closest('.aiw-page-host')?.getBoundingClientRect();
      const top = Math.max(0, host?.top ?? 0);
      const bottom = Math.min(window.innerHeight, host?.bottom ?? window.innerHeight);
      const below = Math.max(0, bottom - rect.bottom - 16);
      const above = Math.max(0, rect.top - top - 16);
      const nextPlacement = below < 180 && above > below ? 'top' : 'bottom';
      setPlacement(nextPlacement);
      setAvailableHeight(Math.min(420, nextPlacement === 'top' ? above : below));
    };
    measure();
    const frame = requestAnimationFrame(() => { root.current?.querySelector('[data-history-version]')?.focus({preventScroll:true}); });
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', measure);
    document.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', measure);
      document.removeEventListener('scroll', measure, true);
    };
  }, [open]);
  return <div className="aiwsd-version-control" ref={root} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(false); }} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
    if (!open && ['ArrowDown','ArrowUp'].includes(event.key)) { event.preventDefault(); setExpanded(null); setOpen(true); }
  }} style={{'--aiwsd-history-height':`${availableHeight}px`}}>
    <button ref={trigger} type="button" className="aiwsd-link aiwsd-version-trigger" aria-label={`查看历史版本，当前 ${currentVersion}`} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={()=>{setExpanded(null);setOpen(value=>!value);}}>{currentVersion}<ChevronDown size={12}/></button>
    {open && <div id={panelId} className="aiwsd-history-anchor" data-placement={placement} role="region" aria-label="历史版本"><DropdownPanel className="aiwsd-history-dropdown" label="历史版本记录" onClose={close}>
      <p className="dropdown-heading aiwsd-history-note">历史版本仅供查看，不支持切换版本。</p>
      {versions.map((version,index)=>{
        const history = version.snapshot ? getSkillDetails(version.snapshot) : null;
        const contentId = `${panelId}-content-${index}`;
        return <div className="aiwsd-history-record" key={`${version.version}-${index}`}>
          <button type="button" data-history-version="" className="aiwsd-history-entry" aria-label={`查看版本 ${version.version} 的内容`} aria-expanded={expanded===index} aria-controls={expanded===index ? contentId : undefined} onClick={()=>setExpanded(value=>value===index ? null : index)}>
            <span>v{version.version}</span><span className="aiwsd-history-date">{version.publishedAt ? String(version.publishedAt).slice(0,10) : '日期未提供'}</span><ChevronDown size={12}/>
          </button>
          {expanded===index && <div className="aiwsd-history-content" id={contentId}>
            {version.snapshot ? <><strong>{version.snapshot.title || item.title}</strong>{version.snapshot.description && <p>{version.snapshot.description}</p>}<pre tabIndex={0} aria-label={`版本 ${version.version} 的只读内容`}>{history.kind==='script' ? history.script : history.kind==='task' ? history.taskContent : history.prompt}</pre></> : <p>此链接保留历史版本号与日期；该版本的正文可由作者在管理页查看。</p>}
          </div>}
        </div>;
      })}
    </DropdownPanel></div>}
  </div>;
}

export default function WorkspaceSkillDetail({ item, backLabel, onBack, onUpdate, onUse, onEdit, onDuplicate, onDelete, onAuthor, onViewPublic, publicView = false, isOwner = item.type === 'custom' }) {
  const display = publicView && item.publication?.snapshot ? {...item, ...item.publication.snapshot} : item;
  const detail = getSkillDetails(display);
  const { Icon, color } = getSkillIllustration(display);
  const [feedback, setFeedback] = useState('');
  const [dialog, setDialog] = useState(null);
  const [variableValues, setVariableValues] = useState({});
  const official = item.type === 'official';
  const installed = official || item.installed || item.type === 'installed';
  const enabled = official || item.enabled !== false;
  const published = item.publication?.status === 'published';
  async function copyContent() {
    try { await navigator.clipboard.writeText(detail.kind === 'script' ? detail.script : detail.kind === 'task' ? detail.taskContent : detail.prompt); setFeedback('内容已复制'); }
    catch { setFeedback('未能复制，请在正文中选择内容复制。'); }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(buildSkillPublicUrl(item)); setFeedback('公开版链接已复制'); }
    catch (error) { setFeedback(error.message || '复制失败，请重试。'); }
  }
  function trial() {
    if (detail.kind === 'prompt' && display.variables?.length) { setVariableValues(Object.fromEntries(display.variables.map(v=>[v.name,v.defaultValue || '']))); setDialog('variables'); }
    else onUse?.(detail.kind === 'task' ? detail.taskContent : detail.prompt);
  }
  function confirmAction() {
    try {
      if (published) revokeSkillPublications(item);
      if (dialog === 'delete') onDelete?.(item);
      else { onUpdate(unpublishSkill(item)); setFeedback('已下架，妙招仍保留在「我的」中。'); }
      setDialog(null);
    } catch { setFeedback('未能保存更改，请重试。'); }
  }
  return <WorkspaceSecondaryPage title={`${display.title}${publicView ? '公开版' : '详情'}`} backLabel={backLabel} onBack={onBack}
    actions={<button className="aiw-secondary-copy" onClick={copyContent}><Copy size={15}/><span>复制内容</span></button>}>
    <header className="aiwsd-heading"><span className="aiws-skill-icon" style={{ '--aiws-icon-accent': color }}><Icon size={28} strokeWidth={1.6}/></span>
      <div><h1 tabIndex={-1}>{display.title}</h1><p>{detail.typeLabel}<span>·</span>{detail.category}{publicView && <><span>·</span>公开版</>}</p></div>
      <div className="aiwsd-heading-actions"><button className="aiw-button" disabled={!enabled && (installed || isOwner)} onClick={trial}>试用</button>
        {official ? <span className="aiwsd-preinstalled"><Check size={15}/>官方预装 · 自动更新</span> : !isOwner && !publicView && <button className={`aiw-button ${installed ? 'aiwsd-installed' : 'aiw-button-primary'}`} aria-pressed={installed} onClick={() => onUpdate({ ...item, type: item.type === 'installed' ? 'community' : item.type, installed: !installed, enabled: !installed ? true : item.enabled })}>{installed ? <Check size={16}/> : <Plus size={16}/>}<span>{installed ? '卸载' : '安装'}</span></button>}
        {isOwner && !publicView && <button className="aiw-button" onClick={()=>onEdit?.(item)}>编辑妙招</button>}
        {isOwner && <button className="aiw-button aiw-button-primary" onClick={()=>setDialog('publish')}>{published ? '发布更新' : '发布妙招'}</button>}
      </div>
    </header>
    {isOwner && <div className="aiwsd-management" aria-label="自定义妙招管理">
      <button className="aiw-button" onClick={()=>onDuplicate?.(item)}>创建副本</button>
      {published && <><button className="aiw-button" onClick={copyLink}>复制链接</button>{!publicView && <button className="aiw-button" onClick={()=>onViewPublic?.(item)}>查看公开版</button>}<button className="aiw-button" onClick={()=>setDialog('unpublish')}>下架妙招</button></>}
      <button className="aiw-button aiwsd-danger" onClick={()=>setDialog('delete')}>删除妙招</button>
      <span className="aiwsd-publish-state">{published ? `已发布 · v${item.publication.version} · ${item.publication.visibility === 'plaza' ? '广场公开' : '链接可见'}` : item.publication ? '已下架' : '未发布'}</span>
    </div>}
    {!official && !publicView && (installed || isOwner) && <div className="aiwsd-enabled"><button type="button" role="switch" aria-label="启用妙招" aria-checked={enabled} onClick={()=>onUpdate({...item,enabled:!enabled})}><span/></button><span>{enabled ? '已启用' : '已停用'}</span><small>{enabled ? '在需要时使用这个妙招' : '内容已保留，重新启用即可使用'}</small></div>}
    {feedback && <p className="aiwsd-feedback" role="status">{feedback}</p>}
    <div className="aiwsd-layout"><main className="aiwsd-main">
      {display.cover ? <img className="aiwsd-public-cover" src={display.cover} alt={`${display.title}封面`}/> : <Gallery item={display} detail={detail} Icon={Icon} color={color}/>}
      <section className="aiwsd-section"><h2>简介</h2><p>{display.description || '暂无简介'}</p>{display.examples?.length > 0 && <><h3>示例问法</h3><ul>{display.examples.map((example,index)=><li key={index}>{example}</li>)}</ul></>}</section>
      {!publicView && <section className="aiwsd-section">
        {detail.kind === 'prompt' && <Choice label="一键发送" value={Boolean(item.autoSend)} options={[[false, '关闭'], [true, '开启']]} onChange={autoSend => onUpdate({ ...item, autoSend })} description={item.autoSend ? '已保存一键发送偏好；本地试用仍只填入草稿。' : '选择妙招后填入输入框，由你确认发送。'}/>}
        {detail.kind === 'script' && <Choice label="运行方式" value={item.runMode || 'manual'} options={[["manual", '手动运行'], ['auto', '自动运行']]} onChange={runMode => onUpdate({ ...item, runMode })} description="运行偏好仅保存在本地，此原型不会向网页注入或运行脚本。"/>}
      </section>}
      {detail.kind !== 'prompt' && <section className="aiwsd-section aiwsd-websites"><h2>适用网站</h2><div>{detail.websites.map(site => <span key={site}><Globe size={14}/>{site}</span>)}</div></section>}
      <section className="aiwsd-section"><h2>妙招内容</h2>
        {detail.kind === 'task' && <><h3>任务描述</h3><p className="aiwsd-text-panel">{detail.taskDescription}</p><h3>SKILL.md</h3><TaskDocument item={display} detail={detail}/></>}
        {detail.kind === 'prompt' && <><h3>提示词内容</h3><pre className="aiwsd-code aiwsd-prompt" tabIndex={0}>{detail.prompt}</pre>{display.variables?.length > 0 && <><h3>变量与默认值</h3><dl className="aiwsd-variables">{display.variables.map(v=><div key={v.name}><dt>{'{{'+v.name+'}}'}</dt><dd>{v.defaultValue || '使用时填写'}</dd></div>)}</dl></>}</>}
        {detail.kind === 'script' && <><h3>脚本代码{!display.code && !display.script && <span className="aiw-demo-badge">示例</span>}</h3><pre className="aiwsd-code" tabIndex={0}><code>{detail.script}</code></pre></>}
      </section>
    </main><aside className="aiwsd-metadata" aria-label="妙招信息"><dl>
      <dt>创建者</dt><dd><button className="aiwsd-link" onClick={()=>onAuthor?.(item.author || '我')}>{detail.author}<ChevronRight size={12}/></button></dd><dt>类型</dt><dd>{detail.typeLabel}</dd><dt>分类</dt><dd>{detail.category}</dd>
      <dt>安装人数</dt><dd>{Number.isFinite(display.installCount) ? `${display.installCount.toLocaleString('zh-CN')} 人` : '暂无数据'}</dd>
      <dt>最后更新</dt><dd>{detail.updatedAt}</dd><dt>版本</dt><dd><VersionDropdown item={display} currentVersion={detail.version}/></dd>
    </dl></aside></div>
    {dialog==='publish' && <SkillPublishDialog item={item} onClose={()=>setDialog(null)} onSave={next=>{onUpdate(next);setDialog(null);setFeedback(`已保存公开版 v${next.publication.version}`);}}/>}
    {(dialog==='delete' || dialog==='unpublish') && <SkillDialog title={dialog==='delete' ? '删除妙招' : '下架妙招'} onClose={()=>setDialog(null)}><div className="aiw-content-form"><p>{dialog==='delete' ? `删除「${item.title}」及其本地发布记录？此操作无法撤销。` : '下架后将从本地广场移除，已创建的内容仍保留在「我的」中，可再次发布。'}</p>{published && <p className="aiw-form-note">本浏览器中的旧链接会失效。已复制给其他人的内容无法撤回。</p>}<div className="aiw-dialog-actions"><button className="aiw-button" onClick={()=>setDialog(null)}>取消</button><button className="aiw-button aiw-button-primary" onClick={confirmAction}>{dialog==='delete' ? '确认删除' : '确认下架'}</button></div></div></SkillDialog>}
    {dialog==='variables' && <SkillDialog title="填写妙招变量" onClose={()=>setDialog(null)}><form className="aiw-content-form" onSubmit={e=>{e.preventDefault();onUse?.(detail.prompt.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(match,name)=>variableValues[name.trim()] ?? match));setDialog(null);}}>{display.variables.map(v=><label key={v.name}>{v.name}<input aria-label={v.name} value={variableValues[v.name] || ''} onChange={e=>setVariableValues(values=>({...values,[v.name]:e.target.value}))}/></label>)}<div className="aiw-dialog-actions"><button className="aiw-button" type="button" onClick={()=>setDialog(null)}>取消</button><button className="aiw-button aiw-button-primary">填入对话</button></div></form></SkillDialog>}
  </WorkspaceSecondaryPage>;
}
