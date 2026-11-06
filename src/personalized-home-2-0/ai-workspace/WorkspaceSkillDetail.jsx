import { useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Globe, Plus } from '../icons';
import WorkspaceSecondaryPage from './WorkspaceSecondaryPage';
import { getSkillIllustration } from './workspace-skill-icons';
import { getSkillDetails } from './workspace-skill-details';
import './workspace-skill-detail.css';

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
export default function WorkspaceSkillDetail({ item, backLabel, onBack, onUpdate, onUse }) {
  const detail = getSkillDetails(item);
  const { Icon, color } = getSkillIllustration(item);
  const [feedback, setFeedback] = useState('');
  const installed = item.installed || item.type === 'installed';
  async function copyContent() {
    try { await navigator.clipboard.writeText(detail.kind === 'script' ? detail.script : detail.kind === 'task' ? detail.taskContent : detail.prompt); setFeedback('内容已复制'); }
    catch { setFeedback('未能复制，请在正文中选择内容复制。'); }
  }
  return <WorkspaceSecondaryPage title={`${item.title}详情`} backLabel={backLabel} onBack={onBack}
    actions={<button className="aiw-secondary-copy" onClick={copyContent}><Copy size={15}/><span>复制内容</span></button>}>
    <header className="aiwsd-heading"><span className="aiws-skill-icon" style={{ '--aiws-icon-accent': color }}><Icon size={28} strokeWidth={1.6}/></span>
      <div><h1 tabIndex={-1}>{item.title}</h1><p>{detail.typeLabel}<span>·</span>{detail.category}</p></div>
      <div className="aiwsd-heading-actions"><button className="aiw-button" onClick={() => onUse(detail.prompt)}>试用</button>{item.type !== 'custom' && <button className={`aiw-button ${installed ? 'aiwsd-installed' : 'aiw-button-primary'}`} aria-pressed={installed} onClick={() => onUpdate({ ...item, type: item.type === 'installed' ? 'community' : item.type, installed: !installed })}>{installed ? <Check size={16}/> : <Plus size={16}/>}<span>{installed ? '已安装' : '安装'}</span></button>}</div>
    </header>
    {feedback && <p className="aiwsd-feedback" role="status">{feedback}</p>}
    <div className="aiwsd-layout"><main className="aiwsd-main">
      <Gallery item={item} detail={detail} Icon={Icon} color={color}/>
      <section className="aiwsd-section"><h2>简介</h2><p>{item.description || '暂无简介'}</p></section>
      <section className="aiwsd-section">
        {detail.kind === 'prompt' && <Choice label="一键发送" value={Boolean(item.autoSend)} options={[[false, '关闭'], [true, '开启']]} onChange={autoSend => onUpdate({ ...item, autoSend })} description={item.autoSend ? '已保存一键发送偏好；本地试用仍只填入草稿。' : '选择妙招后填入输入框，由你确认发送。'}/>}
        {detail.kind === 'script' && <Choice label="运行方式" value={item.runMode || 'manual'} options={[['manual', '手动运行'], ['auto', '自动运行']]} onChange={runMode => onUpdate({ ...item, runMode })} description="运行偏好仅保存在本地，此原型不会向网页注入或运行脚本。"/>}
        {detail.kind !== 'prompt' && <div className="aiwsd-websites"><h2>适用网站</h2><div>{detail.websites.map(site => <span key={site}><Globe size={14}/>{site}</span>)}</div></div>}
      </section>
      <section className="aiwsd-section"><h2>妙招内容</h2>
        {detail.kind === 'task' && <><h3>任务描述</h3><p className="aiwsd-text-panel">{detail.taskDescription}</p><h3>SKILL.md{!item.skillMarkdown && <span className="aiw-demo-badge">示例</span>}</h3><TaskDocument item={item} detail={detail}/></>}
        {detail.kind === 'prompt' && <><h3>提示词内容</h3><pre className="aiwsd-code aiwsd-prompt" tabIndex={0}>{detail.prompt}</pre></>}
        {detail.kind === 'script' && <><h3>脚本代码{!item.code && !item.script && <span className="aiw-demo-badge">示例</span>}</h3><pre className="aiwsd-code" tabIndex={0}><code>{detail.script}</code></pre></>}
      </section>
    </main><aside className="aiwsd-metadata" aria-label="妙招信息"><dl>
      <dt>创建者</dt><dd>{detail.author}</dd><dt>类型</dt><dd>{detail.typeLabel}</dd><dt>分类</dt><dd>{detail.category}</dd>
      <dt>使用量</dt><dd>{Number(item.usageCount || 0).toLocaleString('zh-CN')} 次<span className="aiw-demo-badge">示例</span></dd>
      <dt>最后更新</dt><dd>{detail.updatedAt}</dd><dt>版本</dt><dd>{detail.version}</dd>
    </dl><p>本地示例 · 试用将内容填入对话草稿。</p></aside></div>
  </WorkspaceSecondaryPage>;
}
