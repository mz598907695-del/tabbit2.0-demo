import ShortcutIcon, { ShortcutIconTile } from './ShortcutIcon';
import './resizable-shortcut.css';

/** One surface owns both the artwork and text, including its glass material. */
export default function ResizableShortcut({ item = {}, appearanceTheme = 'light', iconSize = 'small', shape = 'circle' }) {
  const expanded = item.w > 1 || item.h > 1;
  if (!expanded) return <ShortcutIconTile item={item} appearanceTheme={appearanceTheme} iconSize={iconSize} shape={shape} />;

  const horizontal = item.w > item.h;
  return <span className="shortcut-icon resizable-shortcut"
    data-shortcut-shape={shape} data-brand={item.key}
    data-shortcut-layout={horizontal ? 'horizontal' : 'vertical'}>
    <ShortcutIcon item={item} appearanceTheme={appearanceTheme} iconSize={iconSize === 'small' ? 'small' : 'medium'} />
    <span className="resizable-shortcut-name" title={item.label}>{item.label}</span>
  </span>;
}
