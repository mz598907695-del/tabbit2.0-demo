import { memo, useMemo } from 'react';
import { BoardItemContent } from './BoardItemContent';
import { boardColumns, gridProfile, projectPage } from './state';
import { getBoardRows } from './layout';
import { boardAlignmentOffset } from './drag-geometry';

function BoardPagePreview({ page, width, sourceColumns, appearanceTheme, shortcutSize, shortcutShape, showLabels }) {
  const columns = boardColumns(width, showLabels, page.preferredColumns);
  const profile = gridProfile('gap', showLabels, (width - 50) / (columns - 1));
  const columnWidth = profile.pitch;
  const items = useMemo(() => projectPage(page, columns, 'gap', showLabels, 'free', sourceColumns), [page, columns, showLabels, sourceColumns]);
  const offset = boardAlignmentOffset(items, width, columnWidth, profile.gap);
  return <div className="board-grid" style={{ height: Math.max(1, getBoardRows(items)) * profile.pitch }}>
    {items.map(item => {
      const widget = item.type === 'widget', expanded = !widget && (item.w > 1 || item.h > 1);
      return <article key={item.id} data-design-item={item.id} className={`board-item ${widget ? 'is-widget' : 'is-shortcut'}${expanded ? ' is-expanded-shortcut' : ''}`} style={{ width: item.w * columnWidth - profile.gap, height: item.h * profile.pitch - profile.gap, translate: `${offset + item.x * columnWidth}px ${item.y * profile.pitch}px` }}>
        <BoardItemContent item={item} appearanceTheme={appearanceTheme} shortcutSize={shortcutSize} shortcutShape={shortcutShape} preview/>
      </article>;
    })}
  </div>;
}

export default memo(BoardPagePreview);
