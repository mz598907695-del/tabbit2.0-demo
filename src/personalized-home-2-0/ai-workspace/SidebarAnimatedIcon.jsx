import { MessageCirclePlus, Lightbulb, AlarmClock, SidebarDashboard, Folder, MessageSquare } from '../icons';
const icons = { home: MessageCirclePlus, skills: Lightbulb, tasks: AlarmClock, files: SidebarDashboard, chats: MessageSquare };
export default function SidebarAnimatedIcon({ kind, size = 18, active = false }) {
 if (kind === 'shares') return <span className="session-nav-icon" data-active={active || undefined}><span className="iconfont icon-gongxiang_yuan" aria-hidden="true" style={{ fontSize:size }}/></span>;
 if (kind === 'bookmarks') return <span className="session-nav-icon" data-active={active || undefined}><span className="solid-star-icon" aria-hidden="true" style={{ width:size, height:size }}/></span>;
 const Icon = icons[kind] || Folder;
 return <span className="session-nav-icon" data-active={active || undefined}><Icon size={size}/></span>;
}
