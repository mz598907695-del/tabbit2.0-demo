import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DropdownPanel from '../DropdownPanel';
import SpaceIcon from '../SpaceIcon';
import verticalTabsIcon from '../assets/vertical-tabs.svg';
import collapseTabsIcon from '../assets/collapse-tabs.svg';
import expandTabsIcon from '../assets/expand-tabs.svg';
import { SpaceContext } from './SpaceContext';
import { IconFont, OrganizeTabsMark, TokenIcon } from './BrowserIcons';
import type { Mode } from './types';

export function SpaceContainer({ onClick }: { onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }) {
  const { selectedSpace, spaces, visibleSpaceIds } = useContext(SpaceContext);
  const singleSpace = visibleSpaceIds.length === 1;
  const previousSpace = useRef(selectedSpace);
  const contentRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const previous = previousSpace.current;
    previousSpace.current = selectedSpace;
    const content = contentRef.current;
    if (!content || previous === selectedSpace || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const direction = selectedSpace > previous ? 1 : -1;
    const styles = getComputedStyle(content);
    const animation = content.animate([
      { transform: `translateX(${direction * 12}px)`, opacity: 0 },
      { transform: "translateX(0)", opacity: 1 }
    ], { duration: parseFloat(styles.getPropertyValue("--space-switch-duration")) || 400, easing: styles.getPropertyValue("--motion-easing-standard").trim() || "ease-out" });
    return () => animation.cancel();
  }, [selectedSpace, singleSpace]);
  return <button className={`space-container ${singleSpace ? "single-space" : ""}`} aria-label={singleSpace ? "空间菜单" : undefined} onClick={onClick}>
    {singleSpace ? <OrganizeTabsMark className="space-icon"/> : <span className="space-content-clip"><span className="space-content" ref={contentRef}>
      <SpaceIcon className="space-icon" space={spaces[selectedSpace]}/>
      <span>{spaces[selectedSpace].name}</span>
    </span></span>}
  </button>;
}

export default function SpaceMenu({ mode, onMode, onClose, setAll, onDelete, onEdit, onCreate }: { mode: Mode; onMode: (mode: Mode) => void; onClose: () => void; setAll: (open: boolean) => void; onDelete: () => void; onEdit: () => void; onCreate: () => void }) {
  const { selectedSpace, selectSpace, visibleSpaceIds, spaces } = useContext(SpaceContext);
  const [tip, setTip] = useState<{ index: number; left: number; top: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTip = () => {
    if (tipTimer.current !== null) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTip(null);
  };
  useEffect(() => () => { if (tipTimer.current !== null) clearTimeout(tipTimer.current); }, []);
  const showTip = (element: HTMLButtonElement, index: number) => {
    hideTip();
    const rect = element.getBoundingClientRect();
    tipTimer.current = setTimeout(() => {
      tipTimer.current = null;
      setTip({ index, left: Math.max(85, Math.min(window.innerWidth - 85, rect.left + rect.width / 2)), top: rect.top >= 38 ? rect.top - 8 : rect.bottom + 34 });
    }, 400);
  };
  return <DropdownPanel className="space-menu" label="空间菜单" onClose={onClose}>
    <div className="space-icon-grid">{visibleSpaceIds.map((index) => <button className={index === selectedSpace ? "selected" : ""} key={index} aria-label={spaces[index].name} aria-pressed={index === selectedSpace} onClick={() => { selectSpace(index); hideTip(); onClose(); }} aria-describedby={tip?.index === index ? "space-tooltip" : undefined} onMouseEnter={(event) => showTip(event.currentTarget, index)} onMouseLeave={hideTip} onFocus={(event) => showTip(event.currentTarget, index)} onBlur={hideTip}><SpaceIcon space={spaces[index]}/></button>)}<button className="space-add" aria-label="添加空间" onClick={onCreate}><IconFont name="jiahao"/></button></div>
    {tip && createPortal(<div id="space-tooltip" role="tooltip" className="space-tooltip" style={{ left: tip.left, top: tip.top }}><span>{spaces[tip.index].name}</span>{visibleSpaceIds.indexOf(tip.index) < 9 && <span className="space-tooltip-keys"><kbd>⌥</kbd><kbd>{visibleSpaceIds.indexOf(tip.index) + 1}</kbd></span>}</div>, document.body)}
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button><span className="dropdown-item-content"><OrganizeTabsMark/><span>智能标签整理</span></span></button>
    <button onClick={() => { onMode(mode === "horizontal" ? "vertical" : "horizontal"); onClose(); }}><span className="dropdown-item-content"><TokenIcon src={verticalTabsIcon}/><span>切换为{mode === "horizontal" ? "垂直" : "水平"}标签栏</span></span></button>
    <button><span className="dropdown-item-content"><IconFont name="sort"/><span>标签页排序</span></span><span className="dropdown-item-trailing"><IconFont name="jiantou-v-xiangyou" className="menu-end"/></span></button>
    <button onClick={() => setAll(false)}><span className="dropdown-item-content"><TokenIcon src={collapseTabsIcon}/><span>收起所有标签组</span></span></button>
    <button onClick={() => setAll(true)}><span className="dropdown-item-content"><TokenIcon src={expandTabsIcon}/><span>展开所有标签组</span></span></button>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button><span className="dropdown-item-content"><IconFont name="new-window"/><span>新建独立窗口</span></span><span className="dropdown-shortcut"><kbd>⌘</kbd><kbd>N</kbd></span></button>
    <button><span className="dropdown-item-content"><IconFont name="incognito"/><span>新建无痕窗口</span></span><span className="dropdown-shortcut"><kbd>⇧</kbd><kbd>⌘</kbd><kbd>N</kbd></span></button>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <button onClick={onEdit}><span className="dropdown-item-content"><IconFont name="edit"/><span>编辑空间</span></span></button>
    <button><span className="dropdown-item-content"><IconFont name="shezhi_chilun"/><span>空间管理</span></span></button>
    {visibleSpaceIds.length > 1 && <button className="danger" onClick={onDelete}><span className="dropdown-item-content"><IconFont name="trash"/><span>删除当前空间</span></span></button>}
  </DropdownPanel>;
}
