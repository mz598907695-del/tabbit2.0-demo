import { Ellipsis, Folder } from '../../icons';

import BookmarkSiteIcon from './BookmarkSiteIcon';

export default function BookmarkRow({ node, index, siblings, column = false, active = false, selecting = false, onBack, selected, cut, count, select, openNode, itemMenu, dragProps, dropProps }) {
  const folder = node.kind === 'folder';
  const address = folder ? `${count} 项` : node.url || '请补充网址';
  function activate(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || (selecting && !column)) select(node.id, event, true, siblings);
    else if (column) select(node.id, event, false, siblings);
    else openNode(node);
  }
  return <div role="row" aria-selected={selected} aria-current={active ? 'location' : undefined} data-bookmark-id={node.id} tabIndex={index === 0 ? 0 : -1}
    className={`bkm-row${column ? ' bkm-column-row' : ''}${selected ? ' is-selected' : ''}${active ? ' is-path' : ''}${cut ? ' is-cut' : ''}`}
    {...dragProps(node)} {...dropProps(node.id, column ? 'column-row' : 'row', node, node.parentId)}
    onClick={event => { if (!event.target.closest('button,input,a')) select(node.id, event, false, siblings); }}
    onDoubleClick={event => { if (!event.target.closest('button,input')) openNode(node); }}
    onContextMenu={event => itemMenu(event, [node.id], node)} onKeyDown={event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) itemMenu(event, [node.id], node);
      if (event.target !== event.currentTarget) return;
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 : Math.max(0, Math.min(siblings.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
        event.currentTarget.closest('[role="grid"]').querySelector(`[data-bookmark-id="${CSS.escape(siblings[next].id)}"]`)?.focus();
        if (event.shiftKey) select(siblings[next].id, event, false, siblings, node.id);
      }
      if (event.key === ' ') { event.preventDefault(); select(node.id, event, true, siblings); }
      if (event.key === 'Enter' || (column && event.key === 'ArrowRight' && folder)) {
        event.preventDefault(); const rail = event.currentTarget.closest('.bkm-columns-scroll'); activate(event);
        if (column && folder) requestAnimationFrame(() => rail?.querySelector(`[data-column-id="${CSS.escape(node.id)}"] [role="row"]`)?.focus());
      }
      if (column && event.key === 'ArrowLeft') { event.preventDefault(); onBack?.(); }
    }}>
    <div role="gridcell" className="bkm-row-check"><input type="checkbox" aria-label={`选择 ${node.title}`} checked={selected} onClick={event => { event.stopPropagation(); select(node.id, event, true, siblings); }} onChange={() => {}}/></div>
    <div role="gridcell" className="bkm-item-main">
      <span className="bkm-item-icon">{folder ? <Folder size={16} strokeWidth={1.5}/> : <BookmarkSiteIcon node={node}/>}</span>
      <button className="bkm-item-name" title={[node.title, node.note || node.description, !folder && node.url].filter(Boolean).join('\n')} onClick={activate} onDoubleClick={event => { if (column && !folder) { event.stopPropagation(); openNode(node); } }}>{node.title}</button>
    </div>
    {!column && <div role="gridcell" className={`bkm-row-address${folder ? ' is-folder-count' : ''}`} title={folder ? `直接包含 ${count} 项；进入文件夹查看` : node.url}>{address}</div>}
    {column && folder && <span className="bkm-column-count" title={`包含 ${count} 项`}>{count}</span>}
    <div role="gridcell" className="bkm-row-actions"><button className="bkm-icon bkm-row-menu" aria-label={`${node.title} 更多操作`} onClick={event => itemMenu(event, [node.id], node)}><Ellipsis size={16}/></button></div>
  </div>;
}
