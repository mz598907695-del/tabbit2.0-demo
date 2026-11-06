import { useMemo } from 'react';
import WidgetCard from './WidgetCards';
import ResizableShortcut from './ResizableShortcut';
import { projectPage } from './state';
import { getBoardRows } from './layout';
import { boardAlignmentOffset } from './drag-geometry';

export default function BoardPagePreview({ page, columns, width, columnWidth, profile, sourceColumns, appearanceTheme, shortcutSize, shortcutShape }) {
  const items = useMemo(() => projectPage(page, columns, 'gap', true, 'free', sourceColumns), [page, columns, sourceColumns]);
  const offset = boardAlignmentOffset(items, width, columnWidth, profile.gap);
  return <div className="board-grid" style={{ height: Math.max(1, getBoardRows(items)) * profile.pitch }}>
    {items.map(item => {
      const widget = item.type === 'widget', expanded = !widget && (item.w > 1 || item.h > 1);
      return <article key={item.id} data-design-item={item.id} className={`board-item ${widget ? 'is-widget' : 'is-shortcut'}${expanded ? ' is-expanded-shortcut' : ''}`} style={{ width: item.w * columnWidth - profile.gap, height: item.h * profile.pitch - profile.gap, translate: `${offset + item.x * columnWidth}px ${item.y * profile.pitch}px` }}>
        {widget ? <WidgetCard kind={item.kind} item={item} size={item.size} inert active={false} /> : <span className="shortcut"><ResizableShortcut item={item} appearanceTheme={appearanceTheme} iconSize={shortcutSize} shape={shortcutShape} /></span>}
        <span className="board-item-label shortcut-label"><span className="board-item-label-text">{item.label || item.title}</span></span>
      </article>;
    })}
  </div>;
}
