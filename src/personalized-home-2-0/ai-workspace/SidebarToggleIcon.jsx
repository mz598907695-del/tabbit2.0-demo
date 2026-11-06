import { PanelLeftClose, PanelLeftOpen } from '../icons';
export default function SidebarToggleIcon({ expanded = true, ...props }) {
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;
  return <Icon {...props}/>;
}
