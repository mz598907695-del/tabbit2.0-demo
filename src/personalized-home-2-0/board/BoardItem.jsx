import { Minus, MoveDiagonal2 } from '../icons';
import { BoardItemContent, BoardItemLabel, boardItemName } from './BoardItemContent';

// One live board article: geometry, accessible interaction and editing controls.
// The card's material and artwork are owned by BoardItemContent/home-surfaces.css.
export default function BoardItem({
  item, style, editing, selected, dragging, resizing, showLabels,
  appearanceTheme, shortcutSize, shortcutShape, active,
  onSelect, onMoveKey, onPointerDown, onClickCapture, onContextMenu,
  onChange, onRemove, onResizeStart, onResize,
}) {
  const widget = item.type === 'widget';
  const name = boardItemName(item);
  const expanded = !widget && (item.w > 1 || item.h > 1);
  const classes = [
    'board-item', widget ? 'is-widget' : 'is-shortcut',
    expanded && 'is-expanded-shortcut', editing && selected && 'is-selected',
    dragging && 'is-dragging', resizing && 'is-resizing',
  ].filter(Boolean).join(' ');

  return <article
    className={classes} style={style}
    data-design-item={item.id} data-board-item={item.id} data-item-type={item.type}
    data-x={item.x} data-y={item.y} data-w={item.w} data-h={item.h}
    tabIndex={widget ? 0 : undefined}
    aria-label={widget ? editing ? `选择${name}，方向键移动` : `${name}，右键管理` : undefined}
    onFocus={event => { if (editing && widget && event.target === event.currentTarget) onSelect(); }}
    onKeyDown={event => { if (editing && widget && event.target === event.currentTarget) onMoveKey(event); }}
    onPointerDown={onPointerDown} onClickCapture={onClickCapture} onContextMenu={onContextMenu}
  >
    <BoardItemContent item={item} appearanceTheme={appearanceTheme} shortcutSize={shortcutSize}
      shortcutShape={shortcutShape} editing={editing} active={active} onChange={onChange}
      onSelect={() => { if (editing) onSelect(); }} onKeyDown={event => { if (editing) onMoveKey(event); }}/>
    <BoardItemLabel item={item} showLabels={showLabels}/>
    {editing && <button type="button" className="board-remove-button" aria-label={`删除${name}`} title={`删除${name}`}
      onClick={event => { event.stopPropagation(); onRemove(); }}>
      <Minus size={14} aria-hidden="true"/>
    </button>}
    {widget && <button type="button" className="board-resize-handle" aria-label={`调整${name}大小`}
      title="按住拖拽调整大小，方向键微调" onPointerDown={onResizeStart} onClick={onSelect}
      onKeyDown={event => {
        if (!['ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const axis = ['ArrowRight', 'ArrowLeft'].includes(event.key) ? 'w' : 'h';
        const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
        onResize({ w: item.w, h: item.h, [axis]: item[axis] + delta }, axis);
      }}>
      <span className="board-resize-visual" aria-hidden="true"><MoveDiagonal2 size={14}/></span>
    </button>}
  </article>;
}
