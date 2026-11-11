import { useRef } from 'react';
import { X } from '../../icons';
import { CircleHelp } from 'lucide-react';
import '../../../styles/dropdown.css';

export default function BookmarkHelp() {
  const panelRef = useRef(null), triggerRef = useRef(null);
  function close() { panelRef.current.hidePopover(); triggerRef.current.focus({ preventScroll: true }); }
  function toggle() {
    const panel = panelRef.current;
    if (panel.matches(':popover-open')) { close(); return; }
    panel.showPopover();
    const anchor = triggerRef.current.getBoundingClientRect(), bounds = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8))}px`;
    panel.style.top = `${Math.max(8, Math.min(anchor.bottom + 8, innerHeight - bounds.height - 8))}px`;
    panel.querySelector('button').focus({ preventScroll: true });
  }
  return <>
    <button ref={triggerRef} className="bkm-icon bkm-help-trigger" aria-label="操作帮助" title="操作帮助" aria-haspopup="dialog" aria-controls="bookmark-help" onClick={toggle}><CircleHelp size={16}/></button>
    <div ref={panelRef} id="bookmark-help" className="bkm-help-panel dropdown-surface" popover="auto" role="dialog" aria-label="收藏操作帮助" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    }}>
      <div className="bkm-help-heading"><h3>操作帮助</h3><button className="bkm-icon" aria-label="关闭操作帮助" onClick={close}><X size={15}/></button></div>
      <dl>
        <div><dt>连续选择</dt><dd>Shift + 点击</dd></div>
        <div><dt>多项选择</dt><dd>⌘ / Ctrl + 点击</dd></div>
        <div><dt>框选条目</dt><dd>从列表空白处拖动</dd></div>
        <div><dt>全选当前目录</dt><dd>⌘ / Ctrl + A</dd></div>
        <div><dt>撤销整理</dt><dd>⌘ / Ctrl + Z</dd></div>
        <div><dt>取消选择</dt><dd>Esc</dd></div>
      </dl>
      <p>拖动所选内容，可移入左侧目录、正文文件夹或分栏。</p>
    </div>
  </>;
}
