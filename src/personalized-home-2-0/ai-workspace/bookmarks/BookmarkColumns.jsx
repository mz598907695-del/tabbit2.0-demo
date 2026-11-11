import { useEffect, useRef } from 'react';
import { ArrowUpRight, Folder, Pencil } from '../../icons';

import BookmarkRow from './BookmarkRow';
import BookmarkSiteIcon from './BookmarkSiteIcon';

export default function BookmarkColumns({ groups, selected, selectedNodes, counts, clipboard, rowProps, marquee, dragging, marqueeHandlers, createAction, onEdit, openNode, onToggleColumn }) {
  const rail = useRef(null), lastFolder = groups.at(-1)?.folder.id;
  const preview = selectedNodes.length === 1 && selectedNodes[0].kind === 'bookmark' ? selectedNodes[0] : null;
  useEffect(() => {
    if (marquee || dragging) return;
    const target = preview ? rail.current?.lastElementChild : rail.current?.querySelector('.bkm-column:last-of-type');
    target?.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'instant' });
  }, [lastFolder, preview?.id, Boolean(marquee), Boolean(dragging)]);
  return <div className="bkm-columns-scroll" ref={rail} aria-label="收藏分栏">
    {groups.map(({ folder, rows }, index) => {
      const selectedCount = rows.filter(node => selected.has(node.id)).length;
      const allSelected = rows.length > 0 && selectedCount === rows.length;
      return <section key={folder.id} className="bkm-column" aria-label={`${folder.title} 分栏`}>
      <header className="bkm-column-heading" {...rowProps.dropProps(folder.id, 'column-header')}><input type="checkbox" aria-label={`${allSelected ? '取消全选' : '全选'} ${folder.title} 当前列`} title={allSelected ? '取消全选当前列' : '全选当前列'} checked={allSelected} disabled={!rows.length}
        ref={element => { if (element) element.indeterminate = selectedCount > 0 && !allSelected; }} onChange={() => onToggleColumn(rows)}/><span title={folder.title}>{folder.title}</span><small>{rows.length} 项</small></header>
      <div className="bkm-column-list" data-column-id={folder.id} {...marqueeHandlers}>
        <div className="bkm-column-content">
          <div role="grid" aria-label={`${folder.title} 内容`} aria-multiselectable="true">
            {rows.map((node, rowIndex) => <BookmarkRow key={node.id} node={node} index={rowIndex} siblings={rows} column active={groups[index + 1]?.folder.id === node.id}
              onBack={() => { if (index > 0) { rowProps.navigate(groups[index - 1].folder.id); requestAnimationFrame(() => rail.current?.querySelector(`[data-bookmark-id="${CSS.escape(folder.id)}"]`)?.focus()); } }} selected={selected.has(node.id)} count={counts[node.id] || 0} cut={clipboard?.mode === 'cut' && clipboard.ids.includes(node.id)} {...rowProps}/>)}
          </div>
          {!rows.length && <div className="bkm-column-empty"><Folder size={26} strokeWidth={1.25}/><span>暂无内容</span><button className="bkm-text-button" onClick={() => createAction('bookmark', folder.id)}>添加收藏</button></div>}
          {marquee?.containerId === folder.id && <div className="bkm-marquee" style={{ left: marquee.left, top: marquee.top, width: marquee.width, height: marquee.height }}/>}
        </div>
      </div>
    </section>; })}
    <aside className="bkm-column-preview" aria-label="收藏预览">
      {preview ? <><BookmarkSiteIcon node={preview} size={32}/><h3>{preview.title}</h3><p className="bkm-preview-url">{preview.url}</p>{(preview.note || preview.description || preview.excerpt) && <p>{preview.note || preview.description || preview.excerpt}</p>}<div className="bkm-preview-actions"><button className="bkm-button is-primary" onClick={() => openNode(preview)}><ArrowUpRight size={15}/>打开网页</button><button className="bkm-button" onClick={() => onEdit(preview)}><Pencil size={14}/>编辑</button></div></>
        : <><Folder size={32} strokeWidth={1.25}/><p>{selectedNodes.length > 1 ? `已选择 ${selectedNodes.length} 项` : '选择文件夹，向右浏览下一层'}<br/><small>{selectedNodes.length > 1 ? '使用下方工具栏批量整理' : '选择网页可查看地址与备注'}</small></p></>}
    </aside>
  </div>;
}
