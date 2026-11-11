import { useState } from 'react';
import { Clock3, FileText, Sparkles } from '../icons';
import './workspace-ai-cards.css';

// Existing output records can contain a cover or metadata only. A metadata
// preview represents that record without pretending it is an installed widget.
export default function WorkspaceAICardPreview({ item, large = false }) {
  const [failed, setFailed] = useState(false);
  const kind = /时钟|clock/i.test(item.title) ? 'clock' : /便签|笔记|note/i.test(item.title) ? 'note' : 'card';
  const Icon = kind === 'clock' ? Clock3 : kind === 'note' ? FileText : Sparkles;
  const now = new Date();
  const formatTime = zone => new Intl.DateTimeFormat('zh-CN', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  if (item.image && !failed) return <img className="aiwc-cover" src={item.image} alt={`${item.title}预览`} onError={() => setFailed(true)}/>;
  return <div className={`aiwc-preview aiwc-preview-${kind}${large ? ' is-large' : ''}`} aria-hidden="true">
    <div className="aiwc-preview-card">
      <div className="aiwc-preview-title"><Icon size={16}/><span>{item.title}</span></div>
      {kind === 'clock' ? <div className="aiwc-clock-face"><span>上海</span><strong>{formatTime('Asia/Shanghai')}</strong><div><span>东京 <b>{formatTime('Asia/Tokyo')}</b></span><span>旧金山 <b>{formatTime('America/Los_Angeles')}</b></span></div></div>
        : kind === 'note' ? <><p className="aiwc-note-copy">{item.description || '留一点空间，记下新的想法。'}</p><span className="aiwc-preview-footnote">{item.title}</span></>
          : <><span className="aiwc-preview-symbol"><Sparkles size={28} strokeWidth={1.5}/></span><p className="aiwc-generic-copy">{item.description || item.title}</p></>}
    </div>
  </div>;
}
