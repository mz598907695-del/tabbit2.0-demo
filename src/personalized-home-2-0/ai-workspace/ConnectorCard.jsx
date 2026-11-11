import { useEffect, useId, useRef, useState } from 'react';
import { Check, Plus, X } from '../icons';

export default function ConnectorCard({ item, added, onToggle }) {
  const [details, setDetails] = useState(false);
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!details) return;
    const node = dialogRef.current;
    node.showModal();
    return () => node.close();
  }, [details]);
  const icon = <span className="aiws-connector-mark" style={{ '--connector-color':item.color }} aria-hidden="true">{item.mark}</span>;
  return <article className="aiws-card aiws-connector-card">
    <button type="button" className="aiws-connector-open" aria-label={`查看 ${item.title}连接器详情`} onClick={() => setDetails(true)}>{icon}<span className="aiws-connector-title">{item.title}</span><span className="aiws-connector-description">{item.description}</span></button>
    <div className="aiws-connector-footer"><span>{item.connectionType === 'mcp' ? 'MCP' : '连接器'} · {item.category}</span><button type="button" className="aiws-connector-add" aria-label={`${added ? '移除' : '添加'} ${item.title}连接器`} aria-pressed={added} onClick={onToggle}>{added ? <Check size={14}/> : <Plus size={14}/>}<span>{added ? '已添加' : '添加'}</span></button></div>
    {details && <dialog ref={dialogRef} className="aiws-connector-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setDetails(false); }}>
      <div className="aiws-connector-dialog-heading">{icon}<h2 id={titleId}>{item.title}</h2><button type="button" className="aiwp-icon-button" aria-label="关闭连接器详情" onClick={() => setDetails(false)}><X size={16}/></button></div>
      <p>{item.description}</p><h3>功能预览</h3><ul>{item.capabilities.map(text => <li key={text}>{text}</li>)}</ul>
      <p className="aiws-connector-note">添加后保存在“我的”中。此演示不会连接或读取你的 {item.title} 账户。</p>
      <button type="button" className="aiwp-primary" onClick={() => { onToggle(); setDetails(false); }}>{added ? '从我的移除' : '添加到我的'}</button>
    </dialog>}
  </article>;
}
