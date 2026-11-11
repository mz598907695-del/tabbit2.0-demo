import WorkspaceListDivider from './WorkspaceListDivider';
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { OutputDownload, OutputShare, FileText, Folder, Globe, Image, MessageCircleReply, Paperclip, PanelsTopLeft, Sparkles, Table2 } from '../icons';
import { createPortal } from 'react-dom';
import { PAGE_TABS, TYPE_LABELS } from './workspace-data';
import { findFileSource, getFileDownload } from './file-actions';
import { formatWorkspaceOutputDate, groupWorkspaceOutputs } from './workspace-output-periods';
import './workspace-files.css';
import WorkspacePageHeader from './WorkspacePageHeader';
import WorkspaceActionButton from './WorkspaceActionButton';

const TYPE_ICONS = { all: Folder, web: Globe, doc: FileText, image: Image, table: Table2, other: Paperclip, card: Sparkles, board: PanelsTopLeft };

export function WorkspaceFilesHeader({ ui, setUI, onCreate, onRefresh }) {
  return <WorkspacePageHeader page="files" title="AI 输出物" action="创建输出物" onAction={onCreate} tabs={PAGE_TABS.files} ui={ui} setUI={setUI} hasViews onRefresh={onRefresh}/>;
}

function FileThumbnail({ item }) {
  const [failed, setFailed] = useState(false);
  const Icon = TYPE_ICONS[item.type] || Paperclip;
  if (item.image && !failed) return <img className="aiwf-thumbnail-image" src={item.image} alt="" loading="lazy" onError={() => setFailed(true)}/>;
  return <div className={`aiwf-preview-art aiwf-preview-${item.type}`} aria-hidden="true">
    {item.type === 'web' ? <><div className="aiwf-web-bar"><i/><i/><i/><span>{item.format || '网页'}</span></div><div className="aiwf-web-cover"><Globe size={24}/><strong>{item.title}</strong></div><p>{item.description}</p><div className="aiwf-preview-lines"><i/><i/><i/></div></>
      : item.type === 'doc' ? <div className="aiwf-paper"><span>{item.format || '文档'} · 文档预览</span><strong>{item.title}</strong><p>{item.description}</p><div className="aiwf-preview-lines"><i/><i/><i/><i/><i/></div><span className="aiwf-paper-source">{item.source || '本机添加'}</span></div>
      : item.type === 'table' ? <div className="aiwf-sheet"><span><Table2 size={16}/>{item.title}</span><div className="aiwf-sheet-cells">{Array.from({ length: 24 }, (_, index) => <i key={index}>{index < 4 ? ['A', 'B', 'C', 'D'][index] : ''}</i>)}</div><p>{item.description}</p></div>
      : <div className="aiwf-generic-preview"><Icon size={36} strokeWidth={1.3}/><strong>{item.format || TYPE_LABELS[item.type] || '文件'}</strong><p>{item.description}</p></div>}
  </div>;
}

function FileActions({ item, chats, onNavigate, onNotice, onShare }) {
  const tooltipId = useId();
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPending, setTooltipPending] = useState(false);
  const tooltipTimer = useRef(null);
  function hideTooltip() { window.clearTimeout(tooltipTimer.current); setTooltipPending(false); setTooltip(null); }
  const tooltipActive = tooltipPending || Boolean(tooltip);
  useEffect(() => {
    if (!tooltipActive) return;
    const hide = hideTooltip;
    document.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    window.addEventListener('resize', hide);
    return () => { window.clearTimeout(tooltipTimer.current); document.removeEventListener('scroll', hide, true); window.removeEventListener('blur', hide); window.removeEventListener('resize', hide); };
  }, [tooltipActive]);
  useEffect(() => () => window.clearTimeout(tooltipTimer.current), []);
  function tooltipProps(key, label) {
    return {
      'aria-describedby': tooltip?.key === key ? tooltipId : undefined,
      onPointerEnter: event => {
        if (event.pointerType === 'touch') return;
        const anchor = event.currentTarget;
        hideTooltip();
        setTooltipPending(true);
        tooltipTimer.current = window.setTimeout(() => {
          setTooltipPending(false);
          if (!anchor.isConnected) return;
          const rect = anchor.getBoundingClientRect();
          setTooltip({ key, label, x:Math.max(70, Math.min(innerWidth - 70, rect.left + rect.width / 2)), y:rect.top - 6 });
        }, 400);
      },
      onPointerLeave: hideTooltip,
      onPointerCancel: hideTooltip,
      onPointerDown: hideTooltip,
    };
  }
  const download = getFileDownload(item);
  const source = findFileSource(item, chats);
  function saveDownload() {
    const url = download.href || URL.createObjectURL(new Blob([download.text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = download.filename; link.click();
    if (!download.href) { setTimeout(() => URL.revokeObjectURL(url), 1000); onNotice('已下载示例摘要；此记录未保存原始文件。'); }
  }
  return <div className="aiwf-file-actions">
    <WorkspaceActionButton aria-label={`分享 ${item.title}`} {...tooltipProps('share', '分享')} onClick={() => onShare(item)}><OutputShare size={16}/></WorkspaceActionButton>
    <WorkspaceActionButton aria-label={`${download.kind === 'original' ? '下载' : '下载示例摘要'} ${item.title}`} {...tooltipProps('download', '下载')} onClick={saveDownload}><OutputDownload size={16}/></WorkspaceActionButton>
    <WorkspaceActionButton aria-label={`查看相关对话 ${item.title}`} {...tooltipProps('source', source ? '查看相关对话' : '未关联来源对话')} disabled={!source} onClick={() => onNavigate?.('chats', `detail:${source.id}`)}><MessageCircleReply size={16}/></WorkspaceActionButton>
    {tooltip && createPortal(<span id={tooltipId} role="tooltip" className="space-tooltip" style={{ left:tooltip.x, top:tooltip.y }}>{tooltip.label}</span>, document.body)}
  </div>;
}

export function WorkspaceFiles({ items, ui, onOpen, selectedId, chats, onNavigate, onNotice, onShare }) {
  const masonryRef = useRef(null);
  useLayoutEffect(() => {
    const grid = masonryRef.current;
    if (!grid) return;
    const update = entries => {
      for (const { target } of entries) {
        // One-pixel grid rows keep every card at its natural content height.
        const span = Math.ceil(target.getBoundingClientRect().height + 12);
        const next = `span ${span}`;
        if (target.style.gridRowEnd !== next) target.style.gridRowEnd = next;
      }
    };
    const observer = new ResizeObserver(update);
    const cards = [...grid.children];
    update(cards.map(target => ({ target })));
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [items, ui.view]);
  const empty = !items.length;
  const periods = groupWorkspaceOutputs(items, { sort: ui.sort });
  const orderedItems = periods.flatMap(period => period.items);
  return <div id="aiwf-results" className="aiwf-results" role="tabpanel" aria-labelledby={`aiwf-tab-${ui.filter}`}>
    {empty ? <div className="aiwf-empty"><span className="aiwf-empty-collection" aria-hidden="true"/><div className="aiwf-empty-copy"><h2>{ui.query ? '没有找到相关输出物' : '这里还没有输出物'}</h2><p>{ui.query ? '试试其他关键词，或查看全部输出物。' : '对话中的资料和你创建的内容会收纳在这里。'}</p></div></div>
      : ui.view === 'grid' ? <div className="aiwf-masonry" ref={masonryRef}>{orderedItems.map(item => <article className={`aiwf-card ${selectedId === item.id ? 'is-previewed' : ''}`} key={item.id}>
        <button className="aiwf-card-open" aria-label={`预览 ${item.title}`} onClick={() => onOpen(item)}>
          <div className={`aiwf-card-preview aiwf-ratio-${item.type}`}><FileThumbnail item={item}/></div>
          <div className="aiwf-card-copy"><span className="aiwf-card-title" title={item.title}>{item.title}</span><span className="aiwf-card-description">{TYPE_LABELS[item.type] || '其他'}</span></div>
        </button>
        <FileActions item={item} chats={chats} onNavigate={onNavigate} onNotice={onNotice} onShare={onShare}/>
      </article>)}</div>
      : <div className="aiwf-table-scroll"><table className="aiwf-table"><colgroup><col/><col className="aiwf-type-column"/><col className="aiwf-date-column"/><col className="aiwf-actions-column"/></colgroup><thead><tr><th scope="col">名称</th><th scope="col">类型</th><th scope="col">创建时间</th><th scope="col">操作</th></tr><WorkspaceListDivider columns={4}/></thead><tbody>
        {orderedItems.map((item, index) => <React.Fragment key={item.id}><tr className={selectedId === item.id ? 'is-previewed' : ''}>
        <td><button className="aiwf-file-name" aria-label={`预览 ${item.title}`} title={item.title} onClick={() => onOpen(item)}><span className="aiwf-list-thumbnail"><FileThumbnail item={item}/></span><span className="aiwf-list-title">{item.title}</span></button></td>
        <td>{TYPE_LABELS[item.type] || '其他'}</td><td><time>{formatWorkspaceOutputDate(item) || '—'}</time></td><td><FileActions item={item} chats={chats} onNavigate={onNavigate} onNotice={onNotice} onShare={onShare}/></td>
      </tr>{index < orderedItems.length - 1 && <WorkspaceListDivider columns={4}/>}</React.Fragment>)}</tbody></table></div>}
  </div>;
}
