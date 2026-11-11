import { useState } from 'react';
import { Check, Copy, Download, MessageCircle, Share2, Sparkles } from '../icons';
import WorkspaceSecondaryPage from './WorkspaceSecondaryPage';
import WorkspaceAICardPreview from './WorkspaceAICardPreview';
import { findFileSource, getFileDownload, getFileShareText } from './file-actions';
import { formatWorkspaceOutputDate } from './workspace-output-periods';

export default function WorkspaceAICardDetail({ item, backLabel, onBack, chats, onNavigate, onShare }) {
  const [shape, setShape] = useState('square');
  const [feedback, setFeedback] = useState('');
  const source = findFileSource(item, chats);
  const download = getFileDownload(item);
  const previewLabel = item.image ? '卡片预览' : '样式预览';
  async function copyInformation() {
    try { await navigator.clipboard.writeText(getFileShareText(item)); setFeedback('卡片信息已复制'); }
    catch { setFeedback('未能复制，请选中下方卡片说明手动复制。'); }
  }
  function saveDownload() {
    const url = download.href || URL.createObjectURL(new Blob([download.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = download.filename; link.click();
    if (!download.href) { setTimeout(() => URL.revokeObjectURL(url), 1000); setFeedback('已下载卡片摘要。'); }
  }
  return <WorkspaceSecondaryPage title={`${item.title}详情`} backLabel={backLabel} onBack={onBack}
    actions={<button className="aiwc-navigation-action" aria-label="复制信息" onClick={copyInformation}><Copy size={15}/><span>复制信息</span></button>}>
    <header className="aiwc-detail-heading">
      <span className="aiwc-detail-icon"><Sparkles size={26} strokeWidth={1.5}/></span>
      <div className="aiwc-detail-title"><h1 tabIndex={-1}>{item.title}</h1><p>AI 卡片<span>·</span>{previewLabel}</p></div>
      <div className="aiwc-detail-actions"><button className="aiw-button" onClick={() => onShare(item)}><Share2 size={15}/>分享</button><button className="aiw-button aiw-button-primary" onClick={saveDownload}><Download size={15}/>{download.kind === 'original' ? '下载' : '下载摘要'}</button></div>
    </header>
    {feedback && <p className="aiwc-feedback" role="status"><Check size={14}/>{feedback}</p>}
    <div className="aiwc-detail-layout">
      <div className="aiwc-detail-main">
        <section className="aiwc-preview-section" aria-label={previewLabel}>
          <div className="aiwc-preview-toolbar"><span>{previewLabel}</span><div role="group" aria-label="预览形状">{[['square','方形'],['wide','横向'],['tall','纵向']].map(([value,label]) => <button key={value} type="button" aria-pressed={shape === value} onClick={() => setShape(value)}>{label}</button>)}</div></div>
          <div className={`aiwc-detail-canvas is-${shape}`}><WorkspaceAICardPreview item={item} large/></div>
          {!item.image && <p className="aiwc-preview-caption">根据卡片信息展示样式。</p>}
        </section>
        <section className="aiwc-detail-section"><h2>卡片说明</h2><p>{item.description || '暂无说明'}</p></section>
        {source && <section className="aiwc-detail-section"><h2>相关对话</h2><button className="aiwc-source-link" onClick={() => onNavigate('chats', `detail:${source.id}`)}><MessageCircle size={17}/><span>{source.title}</span></button></section>}
      </div>
      <aside className="aiwc-detail-information" aria-label="卡片信息"><h2>卡片信息</h2><dl>
        <dt>类型</dt><dd>AI 卡片</dd>
        <dt>创建时间</dt><dd>{formatWorkspaceOutputDate(item) || item.date || '未提供'}</dd>
        <dt>来源</dt><dd>{source?.title || item.source || '本地卡片'}</dd>
        {item.format && <><dt>格式</dt><dd>{item.format}</dd></>}
        {item.size && <><dt>大小</dt><dd>{item.size}</dd></>}
      </dl>{item.tag && item.tag !== 'AI 卡片' && <span className="aiwc-detail-tag">{item.tag}</span>}</aside>
    </div>
  </WorkspaceSecondaryPage>;
}
