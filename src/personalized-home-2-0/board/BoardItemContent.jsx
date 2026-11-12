import WidgetCard from './WidgetCards';
import ResizableShortcut from './ResizableShortcut';

export const boardItemName = item => item.type === 'widget' ? item.title : item.label;

// The live page and gesture preview share the same artwork and label DOM.
// Interactions and drag controls belong to the live article in WorkspaceBoard.
export function BoardItemContent({ item, appearanceTheme, shortcutSize, shortcutShape, editing = false, active = false, onChange, onSelect, onKeyDown, preview = false }) {
  if (item.type === 'widget') {
    return <WidgetCard kind={item.kind} item={item} size={item.size} inert={editing || preview} active={active} onChange={onChange} appearanceTheme={appearanceTheme}/>;
  }
  const artwork = <ResizableShortcut item={item} appearanceTheme={appearanceTheme} iconSize={shortcutSize} shape={shortcutShape}/>;
  if (preview) return <span className="shortcut">{artwork}</span>;
  return <a className="shortcut" href={item.url} target="_blank" rel="noreferrer" title={item.label}
    aria-label={editing ? `选择${boardItemName(item)}，方向键移动` : `打开 ${item.service || item.label}`}
    draggable={false} onFocus={onSelect} onKeyDown={onKeyDown}
    onClick={event => { if (editing) { event.preventDefault(); onSelect?.(); } }}>
    {artwork}
  </a>;
}
