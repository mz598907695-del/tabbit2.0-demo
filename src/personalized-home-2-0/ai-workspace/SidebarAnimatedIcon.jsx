import { MessageCirclePlus, Lightbulb, AlarmClock, SidebarDashboard, Folder, Star, Share2, MessageSquare } from '../icons';
const icons = { home: MessageCirclePlus, skills: Lightbulb, tasks: AlarmClock, files: SidebarDashboard, bookmarks: Star, shares: Share2, chats: MessageSquare };
export default function SidebarAnimatedIcon({ kind, size = 18, active = false }) {
 const Icon = icons[kind] || Folder;
 return <span className="session-nav-icon" data-active={active || undefined}><Icon size={size}/></span>;
}
