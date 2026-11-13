import { getHomeRoot } from "./home-host";
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Controls, ListChecks, Palette, Plus } from "./icons";
import PageMenuPreferences, { pagePreferenceLabel } from './PageMenuPreferences';
import ContextSubmenu from './ContextSubmenu';
import './context-menu.css';

export default function PageContextMenu({ ref, enabled, canEdit, canAddPage = true, preferences, onPreferenceChange, onAdd, onAddPage, onEdit, onPageSettings, onThemeSettings, onOpenChange }) {
  const [menu, setMenu] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  function close(restoreFocus = false) {
    setMenu(null);
    if (restoreFocus && triggerRef.current?.isConnected) triggerRef.current.focus?.({ preventScroll: true });
  }

  function open(event) {
    if (!enabled || !getHomeRoot()?.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.target instanceof Element ? event.target : getHomeRoot();
    const anchor = target.closest('button, a, input, textarea, select, [tabindex]') || document.querySelector('.board-grid:not([inert])');
    triggerRef.current = anchor;
    const rect = target.getBoundingClientRect();
    const keyboard = event.type === 'keydown' || (!event.clientX && !event.clientY);
    // A menu inside a modal must belong to that dialog to remain interactive.
    // Popover puts it above the dialog without clipping or changing its layout.
    const host = target.closest('dialog[open]') || getHomeRoot();
    setMenu({ host, x: keyboard ? rect.left + 8 : event.clientX, y: keyboard ? rect.bottom : event.clientY, keyboard });
  }

  useImperativeHandle(ref, () => ({ open, close }));

  useEffect(() => {
    if (!enabled) { setMenu(null); return; }
    const context = event => { if (!event.defaultPrevented) open(event); };
    const keyboard = event => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
      // Item-specific keyboard menus handle their own triggers.
      if (event.target.closest?.('.board-grid, [data-page-id], [data-navigation-pin], .bkm-app, .home-context-menu')) return;
      open(event);
    };
    document.addEventListener('contextmenu', context);
    document.addEventListener('keydown', keyboard, true);
    return () => {
      document.removeEventListener('contextmenu', context);
      document.removeEventListener('keydown', keyboard, true);
    };
  }, [enabled]);

  useEffect(() => {
    onOpenChange?.(Boolean(menu));
    return () => onOpenChange?.(false);
  }, [Boolean(menu), onOpenChange]);

  useLayoutEffect(() => {
    if (!menu) return;
    const node = menuRef.current;
    node.showPopover?.();
    const bounds = node.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(menu.x, innerWidth - bounds.width - 8))}px`;
    node.style.top = `${Math.max(8, Math.min(menu.y, innerHeight - bounds.height - 8))}px`;
    if (menu.keyboard) node.querySelector(':scope > button:not(:disabled)')?.focus({ preventScroll: true });
    const outside = event => { if (!node.contains(event.target)) close(); };
    const scroll = event => { if (!node.contains(event.target)) close(); };
    const dismiss = () => close();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('blur', dismiss);
      if (node.matches(':popover-open')) node.hidePopover();
    };
  }, [Boolean(menu), menu?.x, menu?.y, menu?.host, menu?.keyboard]);

  if (!menu) return null;
  const act = action => { close(); action?.(); };
  const changeView = (view, keyboardSubmenu = false) => setMenu(current => !current || (current.view === view && current.keyboardSubmenu === keyboardSubmenu) ? current : { ...current, view, keyboardSubmenu });
  const closeSubmenu = (restoreFocus = false) => {
    const trigger = menuRef.current?.querySelector(`[data-setting-key="${menu.view}"]`);
    changeView(null);
    if (restoreFocus) trigger?.focus({ preventScroll: true });
  };
  const hoverRow = event => {
    if (event.pointerType === 'touch') return;
    const row = event.target.closest('button');
    if (row?.parentElement === menuRef.current) changeView(row.disabled ? null : row.dataset.settingKey || null);
  };
  return createPortal(<div ref={menuRef} popover="manual" className="page-context-menu home-context-menu new-tab-context-menu" role="menu" aria-label="看板菜单" onPointerOver={hoverRow}
    onFocusCapture={event => { if (event.target.parentElement === menuRef.current && menu.view && event.target.dataset.settingKey !== menu.view) closeSubmenu(); }}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
    onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
    onKeyDown={event => {
      event.stopPropagation();
      if (event.key === 'Escape' || (event.key === 'ArrowLeft' && menu.view)) { event.preventDefault(); if (menu.view) closeSubmenu(true); else close(true); }
      else if (event.key === 'Tab') close();
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const buttons = [...event.currentTarget.querySelectorAll(':scope > button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
        buttons[next]?.focus();
      }
    }}>
    <button type="button" role="menuitem" data-setting-key="add" aria-haspopup="menu" aria-expanded={menu.view === 'add'} onClick={() => changeView('add', true)} onKeyDown={event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); changeView('add', true); }
    }}><Plus size={16} aria-hidden="true" /><span>添加</span><span className="home-menu-trailing" aria-hidden="true"><ChevronRight size={14}/></span></button>
    <button type="button" role="menuitem" disabled={!canEdit} onClick={() => act(onEdit)}><ListChecks size={16} aria-hidden="true" />批量编辑</button>
    <div role="separator" />
    <PageMenuPreferences preferences={preferences} activeView={menu.view} onView={changeView} onChange={(key, value) => act(() => onPreferenceChange(key, value))} />
    <div role="separator" />
    <button type="button" role="menuitem" onClick={() => act(onPageSettings)}><Controls size={16} aria-hidden="true" />看板设置</button>
    <button type="button" role="menuitem" onClick={() => act(onThemeSettings)}><Palette size={16} aria-hidden="true" />主题设置</button>
    {menu.view && <ContextSubmenu key={menu.view} parentRef={menuRef} anchorKey={menu.view} label={menu.view === 'add' ? '添加' : pagePreferenceLabel(menu.view)} focusOnOpen={menu.keyboardSubmenu} onBack={() => closeSubmenu(true)} onDismiss={() => close(true)}>
      {menu.view === 'add' ? <>
        <button type="button" role="menuitem" disabled={!canAddPage || !onAddPage} title={!canAddPage ? '最多可添加 20 个看板' : undefined} onClick={() => act(onAddPage)}><span className="iconfont icon-jiahao" aria-hidden="true"/>添加看板</button>
        <button type="button" role="menuitem" onClick={() => act(onAdd)}><span className="iconfont icon-jianchakongzhiban" aria-hidden="true"/>添加组件</button>
      </> : <PageMenuPreferences preferences={preferences} view={menu.view} onChange={(key, value) => act(() => onPreferenceChange(key, value))} />}
    </ContextSubmenu>}
  </div>, menu.host);
}
