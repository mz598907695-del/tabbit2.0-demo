import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import {
  AppWindow, Building2, ChevronRight,
  Download, Eraser, FileSearch, Fullscreen, History, Info, KeyRound, Layers3,
  Lightbulb, MessageCircle, Minus, MonitorDown, PanelTopOpen, Plus, Printer,
  Puzzle, Scissors, Settings2, Share2, SquarePlus, Star, Wrench, ZoomIn,
} from 'lucide-react';
import profileAvatar from '../assets/profile-avatar.png';
import DropdownPanel from '../DropdownPanel';
import './browser-more-menu.css';

type MenuIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
type MenuItem = { label:string; icon:MenuIcon; shortcut?:string[]; submenu?:boolean };

const groups: MenuItem[][] = [
  [
    { label:'打开新的标签页', icon:PanelTopOpen, shortcut:['⌘', 'T'] },
    { label:'打开新的窗口', icon:SquarePlus, shortcut:['⌘', 'N'] },
    { label:'打开新的无痕窗口', icon:AppWindow, shortcut:['⇧', '⌘', 'N'] },
  ],
  [
    { label:'密码和自动填充', icon:KeyRound, submenu:true },
    { label:'历史记录', icon:History, submenu:true },
    { label:'下载内容', icon:Download, shortcut:['⌥', '⌘', 'L'] },
    { label:'扩展程序', icon:Puzzle, submenu:true },
    { label:'删除浏览数据…', icon:Eraser, shortcut:['⇧', '⌘', '⌫'] },
  ],
  [
    { label:'收藏', icon:Star, submenu:true },
    { label:'标签页分组', icon:Layers3, submenu:true },
    { label:'全部对话', icon:MessageCircle },
    { label:'妙招', icon:Lightbulb },
  ],
  [
    { label:'屏幕截图', icon:Scissors, submenu:true },
    { label:'打印…', icon:Printer, shortcut:['⌘', 'P'] },
    { label:'查找和修改', icon:FileSearch, submenu:true },
    { label:'投放、保存和分享', icon:Share2, submenu:true },
    { label:'更多工具', icon:Wrench, submenu:true },
  ],
  [
    { label:'反馈', icon:MonitorDown },
    { label:'关于 Tabbit 浏览器', icon:Info },
    { label:'设置', icon:Settings2, shortcut:['⌘', ','] },
  ],
];

function Divider() {
  return <div className="dropdown-divider-container" role="separator"><div className="dropdown-divider"/></div>;
}

function MenuRow({ item, onSelect }:{ item:MenuItem; onSelect:()=>void }) {
  const Icon = item.icon;
  return <button type="button" onClick={onSelect}>
    <span className="dropdown-item-content"><Icon size={14}/><span>{item.label}</span></span>
    {item.shortcut ? <span className="browser-more-shortcut">{item.shortcut.join('')}</span> : item.submenu ? <ChevronRight className="menu-end" size={14}/> : null}
  </button>;
}

export default function BrowserMoreMenu({ anchor, onClose }:{ anchor:HTMLElement; onClose:()=>void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ left:12, top:48, maxHeight:720 });

  useLayoutEffect(() => {
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const width = Math.min(260, window.innerWidth - 24);
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, bounds.right - width));
      const top = Math.max(12, bounds.bottom + 8);
      setPosition({ left, top, maxHeight:Math.max(180, window.innerHeight - top - 12) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const pointerDown = (event:PointerEvent) => {
      if (shellRef.current?.contains(event.target as Node) || anchor.contains(event.target as Node)) return;
      onClose();
    };
    const keyDown = (event:KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
      anchor.focus({ preventScroll:true });
    };
    document.addEventListener('pointerdown', pointerDown, true);
    window.addEventListener('keydown', keyDown, true);
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true);
      window.removeEventListener('keydown', keyDown, true);
    };
  }, [anchor, onClose]);

  return createPortal(<div ref={shellRef} className="browser-more-menu-position" style={{ left:position.left, top:position.top, width:Math.min(260, window.innerWidth - 24), maxHeight:position.maxHeight }}>
    <DropdownPanel className="browser-more-menu" label="Tabbit 浏览器菜单" onClose={onClose}>
      <section className="browser-more-account">
        <span className="browser-more-user"><img src={profileAvatar} alt="" draggable={false}/><strong>用户 #5252</strong></span>
        <span className="browser-more-plan">标准版</span>
      </section>
      <Divider/>
      {groups.map((group, groupIndex) => <Fragment key={groupIndex}>
        <section className="browser-more-group">{group.map(item => <MenuRow key={item.label} item={item} onSelect={onClose}/>)}</section>
        <Divider/>
        {groupIndex === 2 && <>
          <section className="browser-more-group"><div className="browser-more-zoom" aria-label="页面缩放">
            <span className="dropdown-item-content"><ZoomIn size={14}/><span>缩放</span></span>
            <span className="browser-more-zoom-controls">
              <button type="button" aria-label="缩小" onClick={() => setZoom(value => Math.max(25, value - 10))}><Minus size={14}/></button>
              <output>{zoom}%</output>
              <button type="button" aria-label="放大" onClick={() => setZoom(value => Math.min(500, value + 10))}><Plus size={14}/></button>
              <button type="button" aria-label="全屏"><Fullscreen size={14}/></button>
            </span>
          </div></section>
          <Divider/>
        </>}
      </Fragment>)}
      <section className="browser-more-group"><button type="button" onClick={onClose}><span className="dropdown-item-content"><Building2 size={14}/><span>由您的组织管理</span></span></button></section>
    </DropdownPanel>
  </div>, document.body);
}
