import { useRef, useState } from 'react';
import { Upload, Check } from '../icons';
import { readAICardFile } from './ai-card-import';

export default function AIImportCard({ disabled, onImport, hidden }) {
  const input = useRef(null);
  const request = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [feedback, setFeedback] = useState(null);
  async function upload(file) {
    if (!file || disabled || busy) return;
    const id = ++request.current;
    setBusy(true); setFeedback(null); setDragging(false);
    try {
      const pkg = await readAICardFile(file);
      const result = await onImport(pkg);
      if (request.current !== id) return;
      if (!result?.ok) throw new Error(result?.message || '导入失败，请重试');
      setFeedback({ok:true,message:`已添加「${pkg.catalog.title}」`});
    } catch (reason) { if (request.current === id) setFeedback({ok:false,message:reason.message || '文件读取失败，请重试'}); }
    finally { if (request.current === id) setBusy(false); }
  }
  return <article className={`board-library-card board-library-import-card${dragging ? ' is-dragging' : ''}`} hidden={hidden} aria-label="上传 AI 卡片" data-library-kind="ai-import"
    onDragOver={event => { if (!disabled && event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect='copy';setDragging(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
    onDrop={event => {event.preventDefault();setDragging(false);if(event.dataTransfer.files.length!==1){setFeedback({ok:false,message:'请每次上传一个 JSON 文件'});return;}void upload(event.dataTransfer.files[0]);}}>
    <input ref={input} type="file" accept=".json,application/json" aria-label="选择 AI 卡片 JSON 文件" hidden disabled={disabled || busy} onChange={event => {void upload(event.target.files?.[0]);event.target.value='';}} />
    <button type="button" className="board-library-import-zone" disabled={disabled || busy} aria-label="选择 JSON 文件上传 AI 卡片" onClick={() => input.current?.click()}>
      <span className="board-library-json-art" aria-hidden="true"><span className="board-library-json-braces">{'{ }'}</span><span className="board-library-json-extension">.json</span><span className="board-library-json-upload"><Upload size={18}/></span></span>
      <span className="board-library-import-prompt">{busy ? '正在读取卡片…' : dragging ? '松开即可上传' : '选择文件或拖入这里'}</span>
      <span className="board-library-import-format">JSON 格式 · 最大 8 MB</span>
    </button>
    <div className="board-library-copy"><h3 className="board-library-title">上传 AI 卡片</h3><p className="board-library-import-description">把自定义 AI 卡片添加到首页，延续你的灵感。</p>
      <div className={`board-library-import-feedback${feedback && !feedback.ok ? ' is-error' : ''}`} role="status" aria-live="polite">{feedback?.ok && <Check size={14}/>}<span>{feedback?.message || ''}</span></div>
    </div>
  </article>;
}
