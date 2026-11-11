import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type SVGProps } from 'react';
import { createPortal } from 'react-dom';
import profileAvatar from '../assets/profile-avatar.png';
import {
  AlarmClock, Bell, BookOpen, CalendarCheck, Cat, ChevronRight, Clock3,
  Download, Folder, Gauge, Layers, Lightbulb, MessageCircle, Star,
  Ticket,
} from '../personalized-home-2-0/icons';
import { KeyRound } from 'lucide-react';
import WorkspaceNotificationsPopover from '../personalized-home-2-0/ai-workspace/WorkspaceNotificationsPopover';
import '../styles/dropdown.css';
import './profile-menu.css';

type MenuIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;

function UpgradeBoltIcon({ size = 16 }:{ size?:number }) {
  return <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7.7147.5966c.1708-.0316.3467-.0119.5053.0564l.0667.0325.0638.0376c.124.0806.2254.1914.2951.3219l.0325.0667.0262.0695c.0543.1637.0591.3402.0131.5076l-1.1262 3.5395h4.0754c.2202-.0004.4362.0612.6227.1783.187.1174.3365.2857.4318.4848.0953.1991.1324.4211.1065.6403-.0259.2192-.1138.4267-.2529.5981l-.0342.0387-5.7752 5.9501c-.1282.1359-.2954.2291-.4797.2632-.1952.0361-.3969.0047-.5719-.0889-.175-.0936-.3131-.2443-.3914-.4267-.0782-.1823-.0919-.3858-.0393-.5771l.0063-.0228 1.1299-3.5382H2.3331c-.22-.0002-.4357-.0619-.6221-.1788-.1868-.1173-.3365-.2852-.4318-.4842-.0953-.1992-.1324-.4216-.1065-.6409.0259-.2192.1139-.4267.2529-.5981l.0342-.0387L7.235.8598c.1276-.1365.2953-.2291.4797-.2632Z" fill="currentColor"/></svg>;
}

const shortcuts: Array<[string, MenuIcon]> = [
  ['全部对话', MessageCircle], ['我的妙招', Lightbulb], ['我的收藏', Star], ['我的桌宠', Cat],
  ['标签页分组', Layers], ['定时任务', AlarmClock], ['我的项目', Folder],
];

const browserEntries: Array<[string, MenuIcon]> = [
  ['密码和自动填充', KeyRound], ['历史记录', Clock3], ['下载内容', Download],
];

const benefitEntries: Array<{ title:string; detail:string; value?:string; icon:MenuIcon; chevron?:boolean }> = [
  { title:'学生专区', detail:'身份、权益与专属内容', icon:BookOpen, chevron:true },
  { title:'本周剩余用量', detail:'17 小时 23 分钟后重置', value:'99%', icon:Gauge, chevron:true },
  { title:'每日签到', detail:'领用量、桌宠签到', value:'连续 2 天', icon:CalendarCheck },
  { title:'邀好友领专业版会员', detail:'好友助力解锁专属权益', icon:Ticket, chevron:true },
];

export default function ProfileMenu({ anchor, onClose }:{ anchor:HTMLElement; onClose:()=>void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [position, setPosition] = useState({ left:12, top:48, maxHeight:720 });
  const home = document.querySelector<HTMLElement>('.home');
  const surfaceKind = home?.dataset.surfaceThemeKind || 'default';
  const surfaceThemeColor = home?.dataset.surfaceThemeColor || 'transparent';

  useLayoutEffect(() => {
    const place = () => {
      const bounds = anchor.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, bounds.right - width));
      const top = Math.max(12, bounds.bottom + 8);
      setPosition({ left, top, maxHeight:Math.max(180, window.innerHeight - top - 12) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor]);

  useEffect(() => {
    const pointerDown = (event:PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node) || anchor.contains(event.target as Node) || document.querySelector('#aiw-notifications-dropdown')?.contains(event.target as Node)) return;
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

  return createPortal(<div
    ref={menuRef}
    className="profile-menu dropdown-surface"
    data-surface-kind={surfaceKind}
    role="dialog"
    aria-label="个人面板"
    style={{ left:position.left, top:position.top, width:Math.min(320, window.innerWidth - 24), maxHeight:position.maxHeight, '--profile-theme-color':surfaceThemeColor } as CSSProperties}
  >
    <section className="profile-menu-primary">
      <header className="profile-menu-info">
        <img src={profileAvatar} alt="" draggable={false}/>
        <div><strong>李子维</strong><span>标准版</span></div>
        <button ref={notificationButtonRef} type="button" className="profile-menu-bell" data-notification-trigger aria-label="通知" aria-expanded={notificationOpen} onClick={() => setNotificationOpen(open => !open)}><Bell size={17}/><i aria-hidden="true"/></button>
      </header>
      <div className="profile-menu-upgrade-wrap"><button type="button" className="profile-menu-upgrade"><UpgradeBoltIcon size={16}/><span>升级计划</span></button></div>
    </section>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <section className="profile-menu-shortcuts">
      {shortcuts.map(([label, Icon]) => <button type="button" key={label}><span><Icon size={18}/></span><b>{label}</b></button>)}
    </section>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <section className="profile-menu-browser-entries">
      {browserEntries.map(([label, Icon]) => <button type="button" key={label}><Icon size={14}/><span>{label}</span></button>)}
    </section>
    <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>
    <section className="profile-menu-benefits">
      {benefitEntries.map(({ title, detail, value, icon:Icon, chevron }, index) => <Fragment key={title}>
        {index > 0 && <div className="dropdown-divider-container"><div className="dropdown-divider"/></div>}
        <button type="button">
          <span className="profile-menu-benefit-leading"><span className="profile-menu-benefit-icon"><Icon size={16}/></span><span className="profile-menu-benefit-copy"><strong>{title}</strong><small>{detail}</small></span></span>
          <span className="profile-menu-benefit-trailing">{value && <span>{value}</span>}{chevron && <ChevronRight size={16}/>}</span>
        </button>
      </Fragment>)}
    </section>
    {notificationOpen && notificationButtonRef.current && <WorkspaceNotificationsPopover anchor={notificationButtonRef.current} align="right" onClose={(restore:boolean) => { setNotificationOpen(false); if (restore) notificationButtonRef.current?.focus({ preventScroll:true }); }}/>} 
  </div>, document.body);
}
