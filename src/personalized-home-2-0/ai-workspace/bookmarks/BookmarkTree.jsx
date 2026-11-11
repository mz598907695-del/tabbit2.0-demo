import { ChevronRight, Ellipsis, Folder, FolderOpen } from '../../icons';

import { folderPath, ordered } from './bookmark-model';

export default function BookmarkTree({ nodes, expanded, location, counts, onToggle, onNavigate, onMenu, dragProps, dropProps }) {
  const folders = ordered(nodes.filter(node => node.kind === 'folder' && !node.deletedAt));
  function branch(node, depth, color) {
    const children = folders.filter(child => child.parentId === node.id), open = expanded.includes(node.id), active = location === node.id;
    const Icon = open ? FolderOpen : Folder;
    return <div role="treeitem" aria-expanded={children.length ? open : undefined} aria-selected={active} aria-level={depth + 1} key={node.id} data-tree-id={node.id}>
      <div className={`bkm-tree-row${active ? ' is-active' : ''}`} style={{ '--tree-depth': depth, '--folder-color': color }} {...dropProps(node.id, 'tree')} {...dragProps(node)} onContextMenu={event => onMenu(event, [node.id], node)}>
        <button tabIndex={-1} className="bkm-tree-chevron" aria-label={`${open ? '收起' : '展开'} ${node.title}`} disabled={!children.length} onClick={() => onToggle(node.id)}><ChevronRight size={13} style={{ transform: open ? 'rotate(90deg)' : undefined }}/></button>
        <button className="bkm-tree-name" title={folderPath(nodes, node.id).map(item => item.title).join(' / ')} onClick={() => onNavigate(node.id)} onKeyDown={event => {
          const tree = event.currentTarget.closest('[role="tree"]'), buttons = [...tree.querySelectorAll('.bkm-tree-name')], index = buttons.indexOf(event.currentTarget);
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus(); }
          if (event.key === 'ArrowRight') { event.preventDefault(); if (children.length && !open) onToggle(node.id); else buttons[index + 1]?.focus(); }
          if (event.key === 'ArrowLeft') { event.preventDefault(); if (open) onToggle(node.id); else tree.querySelector(`[data-tree-id="${CSS.escape(node.parentId || '')}"] > .bkm-tree-row .bkm-tree-name`)?.focus(); }
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) onMenu(event, [node.id], node);
        }}>
          {depth === 0 && !node.systemRoot ? <span className="bkm-folder-dot"/> : <Icon size={16}/>}<span>{node.title}</span>
        </button>
        <span className="bkm-tree-count" title={`包含子文件夹，共 ${counts[node.id] || 0} 条收藏`}>{counts[node.id] || 0}</span>
        <button className="bkm-icon bkm-tree-more" aria-label={`${node.title} 文件夹菜单`} onClick={event => onMenu(event, [node.id], node)}><Ellipsis size={16}/></button>
      </div>
      {open && children.length > 0 && <div role="group" className="bkm-tree-children" style={{ '--branch-depth': depth }}>{children.map(child => branch(child, depth + 1, color))}</div>}
    </div>;
  }
  const colors = ['#6e98a0', '#b79875', '#8d92ae', '#7b9d87', '#ac8193', '#8f9296'];
  return <div role="tree" aria-label="收藏文件夹" className="bkm-tree">{folders.filter(node => !node.parentId).map((node, index) => branch(node, 0, colors[index % colors.length]))}</div>;
}
