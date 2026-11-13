import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight } from '../../icons';

import ContextSubmenu from '../../ContextSubmenu';
import '../../context-menu.css';
import './bookmark-menu.css';

export default function BookmarkMenu({ menu, onClose }) {
  const ref = useRef(null), [submenu, setSubmenu] = useState(null), [toggles, setToggles] = useState({});
  useLayoutEffect(() => {
    const node = ref.current;
    node.showPopover?.();
    const bounds = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - bounds.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - bounds.height - 8))}px`;
    node.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
    const outside = event => { if (!node.contains(event.target)) onClose(false); };
    const scroll = event => { if (!node.contains(event.target)) onClose(false); };
    const dismiss = () => onClose(false);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      if (node.matches(':popover-open')) node.hidePopover();
    };
  }, [menu]);
  const act = item => {
    if (item.toggle) { const next = !(toggles[item.label] ?? item.checked); setToggles(previous => ({ ...previous, [item.label]: next })); item.action?.(next); }
    else { onClose(true); item.action?.(); }
  };
  function row(item, index, child = false) {
    if (item.separator) return <div role="separator" key={`sep-${index}`}/>;
    const Icon = item.icon, checked = item.toggle ? toggles[item.label] ?? item.checked : item.checked;
    const shortcutKeys = item.shortcut?.replace('⌘/Ctrl', /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? '⌘' : 'Ctrl').split(' ');
    return <Fragment key={item.label}><button type="button" role={item.toggle ? 'menuitemcheckbox' : checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={checked}
      disabled={item.disabled} title={item.hint} className={item.danger ? 'is-danger' : ''}
      data-setting-key={item.children ? String(index) : undefined} aria-haspopup={item.children ? 'menu' : undefined} aria-expanded={item.children ? submenu?.index === index : undefined}
      onPointerEnter={event => { if (!child && event.pointerType !== 'touch') setSubmenu(item.children ? { index, focus: false } : null); }}
      onKeyDown={event => { if (item.children && event.key === 'ArrowRight') { event.preventDefault(); setSubmenu({ index, focus: true }); } }}
      onClick={() => item.children ? setSubmenu({ index, focus: true }) : act(item)}>
      {Icon && <Icon size={16}/>}<span>{item.label}</span>
      {(item.children || item.checked !== undefined) && <span className="home-menu-trailing">{item.toggle ? <span className={`bkm-menu-switch${checked ? ' is-on' : ''}`} aria-hidden="true"><i/></span> : item.children ? <ChevronRight size={16}/> : checked ? <Check size={16}/> : null}</span>}
      {shortcutKeys && <span className="dropdown-shortcut bkm-menu-shortcut">{shortcutKeys.map(key => <kbd key={key}>{key}</kbd>)}</span>}
    </button>{item.preview?.(checked)}</Fragment>;
  }
  // Keep the menu in its owning bookmark page; the native popover escapes clipping.
  // A global home-root lookup can select a hidden browser tab.
  return <div ref={ref} role="menu" aria-label={menu.label} popover="manual" className="home-context-menu page-context-menu bkm-menu"
    onContextMenu={event => event.preventDefault()} onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); onClose(true); }
      if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll(':scope > button:not(:disabled)')], index = buttons.indexOf(document.activeElement);
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
      }
    }}>
    {menu.caption && <div className="home-menu-heading">{menu.caption}</div>}
    {menu.items.map((item, index) => row(item, index))}
    {submenu && menu.items[submenu.index]?.children && <ContextSubmenu parentRef={ref} anchorKey={String(submenu.index)} label={menu.items[submenu.index].label} focusOnOpen={submenu.focus}
      onBack={() => { ref.current?.querySelector(`[data-setting-key="${submenu.index}"]`)?.focus(); setSubmenu(null); }} onDismiss={() => onClose(true)}>
      {menu.items[submenu.index].children.map((item, index) => row(item, index, true))}
    </ContextSubmenu>}
  </div>;
}
